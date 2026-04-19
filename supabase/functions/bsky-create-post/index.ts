import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"
import { corsHeaders } from '../_shared/cors.ts'

// --- HELPER 1: Forjar la Firma Criptográfica DPoP ---
async function generateDpopProof(htu: string, htm: string, privateJwk: any, nonce?: string) {
  // 1. Reconstruir la llave privada
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  // 2. Construir la llave pública (sin la 'd')
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };

  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload: any = {
    jti: crypto.randomUUID(),
    htm: htm,
    htu: htu,
    iat: Math.floor(Date.now() / 1000)
  };
  if (nonce) payload.nonce = nonce;

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const dataToSign = encoder.encode(`${headerB64}.${payloadB64}`);

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    dataToSign
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
  return 'https://bsky.network'; // Fallback
}

// --- HELPER 3: Fetch Nativo con Manejo Automático de Nonce ---
async function fetchWithDpop(url: string, method: string, accessJwt: string, privateJwk: any, body: any) {
  let proof = await generateDpopProof(url, method, privateJwk);
  
  let reqOptions = {
    method,
    headers: {
      'Authorization': `DPoP ${accessJwt}`,
      'DPoP': proof,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };

  let response = await fetch(url, reqOptions);

  // Reintento automático si el servidor nos exige un nuevo Nonce de seguridad
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
    // 1. Autorización Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado en Epistecnología.')

    // 2. Extraer parámetros del Frontend
    const { postText, postLink, previewData } = await req.json()
    if (!postText) throw new Error('El texto del post es obligatorio.')

    // 3. Obtener credenciales de Bluesky de la Base de Datos
    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('access_jwt, refresh_jwt, did, handle')
      .eq('user_id', user.id)
      .single()
      
    if (credsError || !creds) throw new Error('Cuenta de Bluesky no conectada.')

    // 4. Desempaquetar la llave privada DPoP
    const secureData = JSON.parse(creds.refresh_jwt);
    const privateJwk = secureData.jwk;
    if (!privateJwk) throw new Error('Llave criptográfica no encontrada. Por favor reconecta tu cuenta.');

    // 5. Ubicar el servidor exacto del usuario y construir URL Lexicon
    const pdsUrl = await getUserPDS(creds.did);
    const createRecordUrl = `${pdsUrl}/xrpc/com.atproto.repo.createRecord`;

    // 6. Preparar el Record (Objeto de Publicación)
    const record: any = {
      $type: 'app.bsky.feed.post',
      text: postText,
      createdAt: new Date().toISOString(),
      langs: ["es"]
    };

    // Objeto final para la API Lexicon
    const lexiconBody = {
      repo: creds.did,
      collection: 'app.bsky.feed.post',
      record: record
    };

    // 7. Ejecutar petición directa con DPoP
    const bskyResponse = await fetchWithDpop(createRecordUrl, 'POST', creds.access_jwt, privateJwk, lexiconBody);
    
    if (!bskyResponse.ok) {
        const errorText = await bskyResponse.text();
        throw new Error(`Fallo en Bluesky (${bskyResponse.status}): ${errorText}`);
    }

    const published = await bskyResponse.json();

    // 8. Guardar en Caché de Epistecnología (Opcional, pero recomendado para tu feed local)
    const { data: profile } = await supabaseClient.from('profiles').select('display_name, avatar_url').eq('id', user.id).single();
    await supabaseClient.from('community_feed_cache').insert([{
        uri: published.uri,
        cid: published.cid,
        author_did: creds.did,
        author_handle: creds.handle,
        author_display_name: profile?.display_name || creds.handle,
        author_avatar_url: profile?.avatar_url,
        post_text: postText,
        indexed_at: new Date().toISOString()
    }]);

    return new Response(JSON.stringify({ success: true, message: "Publicado vía Lexicon", uri: published.uri }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    });

  } catch (error) {
    console.error("Error en bsky-create-post:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
    });
  }
})