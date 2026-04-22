// /supabase/functions/bsky-lexicon-api/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts" // NUEVO: Decodificador nativo de Deno

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

// ACTUALIZADO: Ahora acepta "contentType" para enviar imágenes crudas (Uint8Array)
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
  
  if (res.status === 401 && res.headers.has('use-dpop-nonce')) {
    currentNonce = res.headers.get('use-dpop-nonce')!;
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

    const pdsUrl = creds.pds_endpoint || 'https://bsky.social';
    const privateJwk = JSON.parse(creds.dpop_private_jwk);
    const payload = await req.json();

    switch (payload.action) {
      
      case 'create_post': {
        let embed: any = undefined;

        // 1. SI HAY IMAGEN: Subimos directo a Bluesky (PDS)
        if (payload.imageBase64) {
            console.log("Procesando imagen nativa para Bluesky...");
            const byteArray = base64Decode(payload.imageBase64);
            const mimeType = payload.imageMimeType || 'image/jpeg';
            
            // Subimos el Blob binario
            const uploadRes = await fetchWithDpop(
              `${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, 
              'POST', creds.access_jwt, privateJwk, byteArray, undefined, mimeType
            );
            
            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Fallo al subir Blob a Bluesky: ${errText}`);
            }
            
            const uploadData = await uploadRes.json();
            
            // Si Bluesky aceptó la imagen, armamos el contenedor
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
        // 2. SI NO HAY IMAGEN, PERO HAY ENLACE: Creamos la tarjeta web
        else if (payload.postLink) {
          embed = {
            $type: 'app.bsky.embed.external',
            external: {
              uri: payload.postLink,
              title: payload.linkTitle || 'Enlace',
              description: payload.linkDescription || '',
            }
          };
          if (payload.linkThumb && payload.linkThumb.startsWith('http')) {
             embed.external.thumb = payload.linkThumb; 
             // Nota: En un futuro ideal, las miniaturas de enlaces también deberían subirse como Blobs
          }
        }

        // 3. Enviamos el Post completo
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
        if (!bskyResponse.ok) throw new Error(`Error en createRecord: ${await bskyResponse.text()}`);
        
        const res = await bskyResponse.json();
        return new Response(JSON.stringify({ success: true, uri: res.uri, cid: res.cid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      // ... resto de tus endpoints (get_post_thread, create_reply, etc) los dejamos intactos
      
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

      default: throw new Error(`Acción ${payload.action} no soportada`);
    }

  } catch (error) {
    console.error("Error Lexicon API:", error);
    // 🔥 EL DETECTOR DE MENTIRAS: Devolvemos 200 pero success false 🔥
    return new Response(JSON.stringify({ 
        success: false, 
        error: `Error interno en Bluesky: ${error.message}` 
    }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
    });
  }
})