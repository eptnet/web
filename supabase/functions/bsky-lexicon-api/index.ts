import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateDpopProof(htu: string, htm: string, privateJwk: any, nonce?: string, accessToken?: string) {
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload: any = { jti: crypto.randomUUID(), htm: htm, htu: htu, iat: Math.floor(Date.now() / 1000) };
  if (nonce) payload.nonce = nonce;
  
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

async function fetchWithDpop(url: string, method: string, accessJwt: string, privateJwk: any, body?: any) {
  let proof = await generateDpopProof(url, method, privateJwk, undefined, accessJwt);
  let reqOptions: any = {
    method,
    headers: { 'Authorization': `DPoP ${accessJwt}`, 'DPoP': proof, 'Content-Type': 'application/json' }
  };
  if (body) reqOptions.body = JSON.stringify(body);
  
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
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } })
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autenticado.');

    const payload = await req.json()
    const { action } = payload;

    const { data: creds } = await supabaseClient.from('bsky_credentials').select('*').eq('user_id', user.id).single();
    if (!creds) throw new Error('AUTH_EXPIRED: Reconecta tu cuenta.');

    const secureData = JSON.parse(creds.refresh_jwt);
    const privateJwk = secureData.jwk;
    const pdsUrl = await getUserPDS(creds.did);

    switch (action) {
      case 'create_post': {
        let embedData = undefined;

        // RADARES DE DIAGNÓSTICO DE IMAGEN
        if (payload.imageUrl) {
            console.log("📸 Iniciando procesamiento de imagen (Base64 recibido)...");
            try {
                let imgBuffer;
                let mimeType = 'image/jpeg';

                if (payload.imageUrl.startsWith('data:')) {
                    console.log("📸 Detectado formato Base64 local.");
                    const [header, base64Data] = payload.imageUrl.split(',');
                    mimeType = header.split(';')[0].split(':')[1];
                    const binaryStr = atob(base64Data);
                    imgBuffer = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) imgBuffer[i] = binaryStr.charCodeAt(i);
                } else {
                    console.log("📸 Detectada URL externa. Haciendo Fetch...");
                    // Añadimos User-Agent para engañar a ImgBB si tiene bloqueo
                    const imgRes = await fetch(payload.imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    
                    if (!imgRes.ok) throw new Error(`Fallo descargando URL externa. HTTP: ${imgRes.status}`);
                    
                    imgBuffer = await imgRes.arrayBuffer();
                    mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
                    console.log(`📸 Imagen descargada con éxito. Tamaño: ${imgBuffer.byteLength} bytes | Tipo: ${mimeType}`);

                    // Si ImgBB nos da un HTML en vez de una foto, detenemos el proceso de imagen.
                    if (mimeType.includes('text/html')) {
                        throw new Error("ImgBB devolvió una página web (HTML), no el enlace directo de la foto (.jpg).");
                    }
                }

                console.log("📸 Subiendo imagen en crudo (Blob) a Bluesky...");
                const uploadUrl = `${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`;
                let proof = await generateDpopProof(uploadUrl, 'POST', privateJwk, undefined, creds.access_jwt);
                
                let blobRes = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `DPoP ${creds.access_jwt}`, 'DPoP': proof, 'Content-Type': mimeType },
                    body: imgBuffer
                });

                if (blobRes.status === 401 && blobRes.headers.has('dpop-nonce')) {
                    proof = await generateDpopProof(uploadUrl, 'POST', privateJwk, blobRes.headers.get('dpop-nonce')!, creds.access_jwt);
                    blobRes = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `DPoP ${creds.access_jwt}`, 'DPoP': proof, 'Content-Type': mimeType },
                        body: imgBuffer
                    });
                }

                if (blobRes.ok) {
                    const blobJson = await blobRes.json();
                    console.log("✅ Blob guardado exitosamente en Bsky:", blobJson.blob.ref);
                    embedData = { $type: 'app.bsky.embed.images', images: [{ alt: "Imagen de comunidad", image: blobJson.blob }] };
                } else {
                    throw new Error(`Error en PDS de Bsky: ${await blobRes.text()}`);
                }
            } catch (e) { 
                console.error("🚨 ERROR PROCESANDO IMAGEN:", e.message); 
            }
        }

        const lexiconBody: any = {
          repo: creds.did,
          collection: 'app.bsky.feed.post',
          record: { $type: 'app.bsky.feed.post', text: payload.text, createdAt: new Date().toISOString(), langs: ["es"] }
        };
        if (embedData) lexiconBody.record.embed = embedData;

        const bskyResponse = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', creds.access_jwt, privateJwk, lexiconBody);
        if (!bskyResponse.ok) throw new Error(`Error Lexicon: ${await bskyResponse.text()}`);
        const published = await bskyResponse.json();

        const { data: profile } = await supabaseClient.from('profiles').select('display_name, avatar_url').eq('id', user.id).single();
        await supabaseClient.from('community_feed_cache').insert([{
            uri: published.uri, cid: published.cid, author_did: creds.did, author_handle: creds.handle, 
            author_display_name: profile?.display_name || creds.handle, author_avatar_url: profile?.avatar_url, 
            post_text: payload.text, embed_external_thumb: payload.imageUrl || null, indexed_at: new Date().toISOString()
        }]);

        return new Response(JSON.stringify({ success: true, uri: published.uri, cid: published.cid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      case 'like_post': {
        if (!payload.postUri || !payload.postCid) throw new Error('Faltan postUri o postCid.');
        const createBody = { repo: creds.did, collection: 'app.bsky.feed.like', record: { $type: 'app.bsky.feed.like', subject: { uri: payload.postUri, cid: payload.postCid }, createdAt: new Date().toISOString() } };
        const bskyResponse = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', creds.access_jwt, privateJwk, createBody);
        if (!bskyResponse.ok) throw new Error(`Error al dar Like: ${await bskyResponse.text()}`);
        const res = await bskyResponse.json();
        return new Response(JSON.stringify({ success: true, uri: res.uri }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      case 'unlike_post': {
        const rkey = payload.likeUri.split('/').pop();
        await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, 'POST', creds.access_jwt, privateJwk, { repo: creds.did, collection: 'app.bsky.feed.like', rkey });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      default: throw new Error(`Acción '${action}' no soportada.`);
    }
  } catch (error) {
    console.error("API Gateway Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})