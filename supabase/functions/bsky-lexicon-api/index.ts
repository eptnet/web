// /supabase/functions/bsky-lexicon-api/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts" 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- UTILIDADES DE SEGURIDAD Y PDS ---
async function generateDpopProof(htu: string, htm: string, privateJwk: any, nonce?: string, accessToken?: string) {
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload: any = { jti: crypto.randomUUID(), htm: htm, htu: htu, iat: Math.floor(Date.now() / 1000) };
  if (nonce) payload.nonce = nonce;
  if (accessToken) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(accessToken));
    payload.ath = base64UrlEncode(hashBuffer);
  }
  
  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signatureBuffer = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, encoder.encode(`${headerB64}.${payloadB64}`));
  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function fetchWithDpop(url: string, method: string, accessToken: string, privateJwk: any, body?: any, nonce?: string, contentType: string = 'application/json') {
  const htu = url.split('?')[0];
  let currentNonce = nonce;
  
  const makeRequest = async (dpopNonce?: string) => {
    const dpopProof = await generateDpopProof(htu, method, privateJwk, dpopNonce, accessToken);
    const headers: any = { 'Authorization': `DPoP ${accessToken}`, 'DPoP': dpopProof };
    const options: RequestInit = { method, headers };
    
    if (body) {
      options.body = contentType === 'application/json' ? JSON.stringify(body) : body;
      options.headers['Content-Type'] = contentType;
    }
    return fetch(url, options);
  };

  let res = await makeRequest(currentNonce);
  
  // 🔥 CORRECCIÓN DEL NONCE: Buscamos la cabecera correcta (dpop-nonce)
  const newNonce = res.headers.get('dpop-nonce');
  
  // Si Bluesky nos pide el Nonce (Error 401 o 400), lo atrapamos y reintentamos mágicamente
  if ((res.status === 401 || res.status === 400) && newNonce) {
    currentNonce = newNonce;
    res = await makeRequest(currentNonce); 
  }
  return res;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error("No autorizado");

    const { data: creds, error: credsError } = await supabaseClient.from('bsky_credentials').select('*').eq('user_id', user.id).single()
    if (credsError || !creds) throw new Error("Credenciales de Bluesky no encontradas");

    const refreshData = JSON.parse(creds.refresh_jwt);
    const privateJwk = refreshData.jwk;
    
    let pdsUrl = 'https://bsky.social'; 
    try {
      if (creds.did.startsWith('did:plc:')) {
        const didRes = await fetch(`https://plc.directory/${creds.did}`);
        const didDoc = await didRes.json();
        const pdsService = didDoc.service?.find((s: any) => s.id === '#atproto_pds');
        if (pdsService) pdsUrl = pdsService.serviceEndpoint;
      }
    } catch (e) {
      console.log("Aviso: No se pudo resolver PDS dinámico, usando bsky.social", e);
    }

    const payload = await req.json();

    switch (payload.action) {
      case 'create_post': {
        let embed: any = undefined;

        if (payload.imageBase64) {
            console.log(`Subiendo imagen nativa al PDS: ${pdsUrl}...`);
            const byteArray = base64Decode(payload.imageBase64);
            const mimeType = payload.imageMimeType || 'image/jpeg';
            
            const uploadRes = await fetchWithDpop(
              `${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, 
              'POST', creds.access_jwt, privateJwk, byteArray, undefined, mimeType
            );
            
            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Rechazo del PDS al subir imagen: ${errText}`);
            }
            
            const uploadData = await uploadRes.json();
            
            if (uploadData.blob) {
                embed = {
                    $type: 'app.bsky.embed.images',
                    images: [{
                        alt: payload.linkTitle || 'Imagen compartida desde Epistecnología',
                        image: uploadData.blob
                    }]
                };
            }
        } 
        // 2. SI NO HAY IMAGEN SOLA, PERO HAY ENLACE (Ej. Eventos y Comunidad)
        else if (payload.postLink) {
          embed = {
            $type: 'app.bsky.embed.external',
            external: {
              uri: payload.postLink,
              title: payload.linkTitle || 'Enlace',
              description: payload.linkDescription || '',
            }
          };
          
          // 🔥 MAGIA PARA MINIATURAS: Descargamos la URL y la subimos al PDS como Blob
          if (payload.linkThumb && payload.linkThumb.startsWith('http')) {
             try {
                 console.log("Procesando miniatura de enlace...");
                 const thumbRes = await fetch(payload.linkThumb);
                 const thumbBuffer = await thumbRes.arrayBuffer();
                 const thumbBytes = new Uint8Array(thumbBuffer);
                 const mimeType = thumbRes.headers.get('content-type') || 'image/jpeg';
                 
                 const uploadRes = await fetchWithDpop(
                   `${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, 
                   'POST', creds.access_jwt, privateJwk, thumbBytes, undefined, mimeType
                 );
                 
                 if (uploadRes.ok) {
                     const uploadData = await uploadRes.json();
                     embed.external.thumb = uploadData.blob; // Adjuntamos el recibo (Blob)
                 }
             } catch(e) {
                 console.error("Aviso: No se pudo subir la miniatura a Bluesky", e);
             }
          }
        }

        const createBody = {
          repo: creds.did,
          collection: 'app.bsky.feed.post',
          record: {
            text: payload.text || '',
            createdAt: new Date().toISOString(),
            embed: embed
          }
        };

        const bskyResponse = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', creds.access_jwt, privateJwk, createBody);
        if (!bskyResponse.ok) throw new Error(`Error al publicar Post: ${await bskyResponse.text()}`);
        
        const res = await bskyResponse.json();
        return new Response(JSON.stringify({ success: true, uri: res.uri, cid: res.cid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      // ... resto de endpoints intactos
      case 'get_post_thread': {
        const url = `${pdsUrl}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(payload.uri)}`;
        const bskyResponse = await fetchWithDpop(url, 'GET', creds.access_jwt, privateJwk);
        const res = await bskyResponse.json();
        return new Response(JSON.stringify(res), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      case 'create_reply': {
        const createBody = {
          repo: creds.did,
          collection: 'app.bsky.feed.post',
          record: {
            text: payload.text,
            createdAt: new Date().toISOString(),
            reply: payload.replyTo
          }
        };
        const bskyResponse = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', creds.access_jwt, privateJwk, createBody);
        const res = await bskyResponse.json();
        return new Response(JSON.stringify({ success: true, uri: res.uri }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      // --- BLOQUES RESTAURADOS PARA BORRAR Y DAR LIKE ---
      
      case 'delete_post': {
        const rkey = payload.postUri.split('/').pop();
        await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, 'POST', creds.access_jwt, privateJwk, { repo: creds.did, collection: 'app.bsky.feed.post', rkey });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      case 'like_post': {
        const createBody = {
          repo: creds.did,
          collection: 'app.bsky.feed.like',
          record: {
            subject: { uri: payload.postUri, cid: payload.postCid },
            createdAt: new Date().toISOString()
          }
        };
        const bskyResponse = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', creds.access_jwt, privateJwk, createBody);
        const res = await bskyResponse.json();
        return new Response(JSON.stringify({ success: true, uri: res.uri }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      case 'unlike_post': {
        const rkey = payload.likeUri.split('/').pop();
        await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, 'POST', creds.access_jwt, privateJwk, { repo: creds.did, collection: 'app.bsky.feed.like', rkey });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      // --------------------------------------------------

      default: throw new Error(`Acción ${payload.action} no soportada`);
    }

  } catch (error) {
    console.error("Error Lexicon API:", error);
    return new Response(JSON.stringify({ success: false, error: `Fallo OAuth: ${error.message}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
})