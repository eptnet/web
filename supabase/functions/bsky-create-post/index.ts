import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HELPER: Generador DPoP ahora incluye el sello 'ath' (Access Token Hash)
async function generateDpopProof(htu: string, htm: string, privateJwk: any, nonce?: string, accessToken?: string) {
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload: any = { jti: crypto.randomUUID(), htm: htm, htu: htu, iat: Math.floor(Date.now() / 1000) };
  if (nonce) payload.nonce = nonce;
  
  // EL FIX CLAVE: Generar el hash del token de acceso y adjuntarlo
  if (accessToken) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(accessToken));
    payload.ath = base64UrlEncode(new Uint8Array(hashBuffer));
  }

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
  // Pasamos el accessJwt para que se genere el sello 'ath'
  let proof = await generateDpopProof(url, method, privateJwk, undefined, accessJwt);
  let reqOptions = {
    method,
    headers: { 'Authorization': `DPoP ${accessJwt}`, 'DPoP': proof, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  let response = await fetch(url, reqOptions);
  
  if (response.status === 401 && response.headers.has('dpop-nonce')) {
    proof = await generateDpopProof(url, method, privateJwk, response.headers.get('dpop-nonce')!, accessJwt);
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
    if (!postText) throw new Error('El texto del post es obligatorio.')
    
    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('access_jwt, refresh_jwt, did, handle')
      .eq('user_id', user.id)
      .single()
      
    if (credsError || !creds) throw new Error('No se encontraron credenciales de Bluesky.')

    let privateJwk;
    try {
      const secureData = JSON.parse(creds.refresh_jwt);
      privateJwk = secureData.jwk;
    } catch (e) {
      throw new Error('AUTH_EXPIRED: Formato antiguo. Reconecta tu cuenta.');
    }

    if (!privateJwk) throw new Error('AUTH_EXPIRED: Llave vacía. Reconecta tu cuenta.');

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
        throw new Error(`Bluesky Error (${bskyResponse.status}): ${errorText}`);
    }

    const published = await bskyResponse.json();

    // Guardado en el caché de comunidad.html
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

    return new Response(JSON.stringify({ success: true, message: "Publicado", uri: published.uri }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    });

  } catch (error) {
    console.error("Error en create-post:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
    });
  }
})