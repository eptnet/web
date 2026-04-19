import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"
import { corsHeaders } from '../_shared/cors.ts'

// --- HELPER 1: Forjar la Firma Criptográfica DPoP ---
async function generateDpopProof(htu: string, htm: string, privateJwk: any, nonce?: string) {
  const privateKey = await crypto.subtle.importKey(
    "jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]
  );
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };

  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload: any = { jti: crypto.randomUUID(), htm: htm, htu: htu, iat: Math.floor(Date.now() / 1000) };
  if (nonce) payload.nonce = nonce;

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const dataToSign = encoder.encode(`${headerB64}.${payloadB64}`);

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } }, privateKey, dataToSign
  );

  return `${headerB64}.${payloadB64}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// --- HELPER 2: Descubrir el Servidor (PDS) del Usuario ---
async function getUserPDS(did: string) {
  try {
    const res = await fetch(`https://plc.directory/${did}`);
    if (res.ok) {
      const doc = await res.json();
      const pdsService = doc.service?.find((s: any) => s.id === '#atproto_pds');
      if (pdsService) return pdsService.serviceEndpoint;
    }
  } catch (e) { console.error("Error resolviendo DID:", e); }
  return 'https://bsky.network';
}

// --- HELPER 3: Fetch Nativo con Manejo de Nonce ---
async function fetchWithDpop(url: string, method: string, accessJwt: string, privateJwk: any, body: any) {
  let proof = await generateDpopProof(url, method, privateJwk);
  let reqOptions = {
    method,
    headers: { 'Authorization': `DPoP ${accessJwt}`, 'DPoP': proof, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };

  let response = await fetch(url, reqOptions);

  if (response.status === 401 && response.headers.has('dpop-nonce')) {
    const nonce = response.headers.get('dpop-nonce')!;
    proof = await generateDpopProof(url, method, privateJwk, nonce);
    reqOptions.headers['DPoP'] = proof;
    response = await fetch(url, reqOptions);
  }

  return response;
}

// --- LÓGICA PRINCIPAL ---
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado.')

    // 1. Obtener datos de la petición
    const { postUri, postCid, likeUri } = await req.json()

    // 2. Obtener credenciales
    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('access_jwt, refresh_jwt, did, handle')
      .eq('user_id', user.id)
      .single()
      
    if (credsError || !creds) throw new Error('Cuenta de Bluesky no conectada.')

    // 3. Extraer la llave privada DPoP
    const secureData = JSON.parse(creds.refresh_jwt);
    const privateJwk = secureData.jwk;
    if (!privateJwk) throw new Error('Llave criptográfica no encontrada.');

    // 4. Ubicar PDS
    const pdsUrl = await getUserPDS(creds.did);

    // --- LÓGICA DE QUITAR LIKE (UNLIKE) ---
    if (likeUri) {
      const deleteRecordUrl = `${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`;
      
      // Una URI es así: at://did:plc:xyz/app.bsky.feed.like/3kxyz...
      // El rkey es la última parte.
      const rkey = likeUri.split('/').pop(); 

      const deleteBody = {
        repo: creds.did,
        collection: 'app.bsky.feed.like',
        rkey: rkey
      };

      const bskyResponse = await fetchWithDpop(deleteRecordUrl, 'POST', creds.access_jwt, privateJwk, deleteBody);
      
      if (!bskyResponse.ok) throw new Error(`Fallo al quitar Like: ${await bskyResponse.text()}`);

      return new Response(JSON.stringify({ success: true, message: 'Like eliminado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    } 
    
    // --- LÓGICA DE DAR LIKE ---
    else {
      if (!postUri || !postCid) throw new Error('Faltan datos del post (URI y CID).')
      
      const createRecordUrl = `${pdsUrl}/xrpc/com.atproto.repo.createRecord`;
      
      const likeRecord = {
        $type: 'app.bsky.feed.like',
        subject: { uri: postUri, cid: postCid },
        createdAt: new Date().toISOString()
      };

      const createBody = {
        repo: creds.did,
        collection: 'app.bsky.feed.like',
        record: likeRecord
      };

      const bskyResponse = await fetchWithDpop(createRecordUrl, 'POST', creds.access_jwt, privateJwk, createBody);
      
      if (!bskyResponse.ok) throw new Error(`Fallo al dar Like: ${await bskyResponse.text()}`);
      
      const likeResult = await bskyResponse.json();

      return new Response(JSON.stringify({ success: true, message: 'Post likeado', uri: likeResult.uri }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

  } catch (error) {
    console.error("Error en bsky-like-post:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
    });
  }
})