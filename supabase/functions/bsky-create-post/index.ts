import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateDpopProof(htu: string, htm: string, privateJwk: any, nonce?: string) {
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload: any = { jti: crypto.randomUUID(), htm: htm, htu: htu, iat: Math.floor(Date.now() / 1000) };
  if (nonce) payload.nonce = nonce;
  
  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const dataToSign = encoder.encode(`${headerB64}.${payloadB64}`);
  
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, privateKey, dataToSign);
  return `${headerB64}.${payloadB64}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getUserPDS(did: string) {
  try {
    const res = await fetch(`https://plc.directory/${did}`);
    if (res.ok) {
      const doc = await res.json();
      const pds = doc.service?.find((s: any) => s.id === '#atproto_pds');
      if (pds) return pds.serviceEndpoint;
    }
  } catch (e) { console.error("PDS Error", e); }
  return 'https://bsky.network';
}

async function fetchWithDpop(url: string, method: string, accessJwt: string, privateJwk: any, body: any) {
  let proof = await generateDpopProof(url, method, privateJwk);
  let reqOptions = {
    method,
    headers: { 'Authorization': `DPoP ${accessJwt}`, 'DPoP': proof, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  let response = await fetch(url, reqOptions);
  
  if (response.status === 401 && response.headers.has('dpop-nonce')) {
    proof = await generateDpopProof(url, method, privateJwk, response.headers.get('dpop-nonce')!);
    reqOptions.headers['DPoP'] = proof;
    response = await fetch(url, reqOptions);
  }
  return response;
}

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

    const { postText } = await req.json()
    
    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('access_jwt, refresh_jwt, did, handle')
      .eq('user_id', user.id)
      .single()
      
    if (credsError || !creds) throw new Error('No se encontraron credenciales de Bluesky en la base de datos.')

    let privateJwk;
    try {
      const secureData = JSON.parse(creds.refresh_jwt);
      privateJwk = secureData.jwk;
    } catch (e) {
      throw new Error('El token refresh_jwt guardado no tiene el formato JSON esperado.');
    }

    if (!privateJwk) throw new Error('El JSON existe, pero la llave privada DPoP (jwk) está vacía o nula.');

    const pdsUrl = await getUserPDS(creds.did);
    const createRecordUrl = `${pdsUrl}/xrpc/com.atproto.repo.createRecord`;

    const lexiconBody = {
      repo: creds.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: postText,
        createdAt: new Date().toISOString(),
        langs: ["es"]
      }
    };

    const bskyResponse = await fetchWithDpop(createRecordUrl, 'POST', creds.access_jwt, privateJwk, lexiconBody);
    
    if (!bskyResponse.ok) {
        const errorText = await bskyResponse.text();
        // Lanzamos el error detallado de Bluesky
        throw new Error(`Bluesky Lexicon Error (${bskyResponse.status}): ${errorText}`);
    }

    const published = await bskyResponse.json();
    return new Response(JSON.stringify({ success: true, message: "Publicado", uri: published.uri }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    });

  } catch (error) {
    // EL TRUCO: Devolvemos 200 para eludir el FunctionsHttpError de comunidad.js
    // pero enviamos el error real en la carga útil.
    console.error("Error capturado:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    });
  }
})