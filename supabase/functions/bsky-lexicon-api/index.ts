import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

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
  let reqOptions: any = { method, headers: { 'Authorization': `DPoP ${accessJwt}`, 'DPoP': proof, 'Content-Type': 'application/json' } };
  if (body) reqOptions.body = JSON.stringify(body);
  let response = await fetch(url, reqOptions);
  if (response.status === 401 && response.headers.has('dpop-nonce')) {
    proof = await generateDpopProof(url, method, privateJwk, response.headers.get('dpop-nonce')!, accessJwt);
    reqOptions.headers['DPoP'] = proof;
    response = await fetch(url, reqOptions);
  }
  return response;
}

// --- NUEVA UTILIDAD: ESCÁNER DE METADATOS (FASE 3) ---
async function getLinkMetadata(url: string) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpistecnologíaBot/1.0)' } });
        const html = await res.text();
        
        const getMeta = (prop: string) => {
            const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
                          html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
            return match ? match[1] : null;
        };

        const title = getMeta('og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || url;
        const description = getMeta('og:description') || getMeta('description') || "";
        const thumb = getMeta('og:image');

        return { title, description, thumb, uri: url };
    } catch (e) {
        return null;
    }
}

async function uploadBlobFromUrl(imageUrl: string, pdsUrl: string, accessJwt: string, privateJwk: any) {
    try {
        const imgRes = await fetch(imageUrl);
        const imgBuffer = await imgRes.arrayBuffer();
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

        const uploadUrl = `${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`;
        let proof = await generateDpopProof(uploadUrl, 'POST', privateJwk, undefined, accessJwt);
        let blobRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Authorization': `DPoP ${accessJwt}`, 'DPoP': proof, 'Content-Type': mimeType },
            body: imgBuffer
        });

        if (blobRes.status === 401 && blobRes.headers.has('dpop-nonce')) {
            proof = await generateDpopProof(uploadUrl, 'POST', privateJwk, blobRes.headers.get('dpop-nonce')!, accessJwt);
            blobRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `DPoP ${accessJwt}`, 'DPoP': proof, 'Content-Type': mimeType },
                body: imgBuffer
            });
        }

        if (blobRes.ok) return (await blobRes.json()).blob;
    } catch (e) { console.error("Error subiendo miniatura externa:", e); }
    return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } })
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autenticado.');

    const payload = await req.json()
    const { action } = payload;
    const { data: creds } = await supabaseClient.from('bsky_credentials').select('*').eq('user_id', user.id).single();
    if (!creds) throw new Error('AUTH_EXPIRED');

    const secureData = JSON.parse(creds.refresh_jwt);
    const privateJwk = secureData.jwk;
    const pdsUrl = await getUserPDS(creds.did);

    switch (action) {
      case 'create_post': 
      case 'create_reply': {
        let embedData = undefined;
        let cdnImageUrl = null;

        // PRIORIDAD 1: Imagen local subida por el usuario
        if (payload.imageUrl) {
            // ... (Lógica de subida de imagen local que ya funciona) ...
            // [Mantenemos el código de procesamiento de Base64 que ya teníamos]
            const [header, base64Data] = payload.imageUrl.split(',');
            const mimeType = header.split(';')[0].split(':')[1];
            const binaryStr = atob(base64Data);
            const imgBuffer = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) imgBuffer[i] = binaryStr.charCodeAt(i);

            const uploadUrl = `${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`;
            let proof = await generateDpopProof(uploadUrl, 'POST', privateJwk, undefined, creds.access_jwt);
            let blobRes = await fetch(uploadUrl, { method: 'POST', headers: { 'Authorization': `DPoP ${creds.access_jwt}`, 'DPoP': proof, 'Content-Type': mimeType }, body: imgBuffer });
            
            if (blobRes.ok) {
                const blobJson = await blobRes.json();
                embedData = { $type: 'app.bsky.embed.images', images: [{ alt: "Imagen", image: blobJson.blob }] };
                const cidRef = blobJson.blob.ref.$link || blobJson.blob.ref;
                cdnImageUrl = `https://cdn.bsky.app/img/feed_thumbnail/plain/${creds.did}/${cidRef}@jpeg`;
            }
        } 
        // PRIORIDAD 2: Si no hay imagen, buscamos metadatos de URL (FASE 3)
        else if (payload.postLink) {
            console.log("🔗 Detectado link para miniatura:", payload.postLink);
            const meta = await getLinkMetadata(payload.postLink);
            if (meta) {
                let thumbBlob = null;
                if (meta.thumb) {
                    thumbBlob = await uploadBlobFromUrl(meta.thumb, pdsUrl, creds.access_jwt, privateJwk);
                }
                embedData = {
                    $type: 'app.bsky.embed.external',
                    external: {
                        uri: meta.uri,
                        title: meta.title,
                        description: meta.description,
                        thumb: thumbBlob || undefined
                    }
                };
            }
        }

        const record: any = { 
            $type: 'app.bsky.feed.post', 
            text: payload.text, 
            createdAt: new Date().toISOString(), 
            langs: ["es"] 
        };
        if (embedData) record.embed = embedData;
        
        // FASE 2: Soporte para respuestas
        if (action === 'create_reply' && payload.replyTo) {
            record.reply = {
                root: { uri: payload.replyTo.rootUri, cid: payload.replyTo.rootCid },
                parent: { uri: payload.replyTo.parentUri, cid: payload.replyTo.parentCid }
            };
        }

        const bskyResponse = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', creds.access_jwt, privateJwk, {
            repo: creds.did,
            collection: 'app.bsky.feed.post',
            record: record
        });

        if (!bskyResponse.ok) throw new Error(await bskyResponse.text());
        const published = await bskyResponse.json();

        // Guardamos en caché (Solo posts principales, no respuestas para no saturar)
        if (action === 'create_post') {
            const { data: profile } = await supabaseClient.from('profiles').select('display_name, avatar_url').eq('id', user.id).single();
            await supabaseAdmin.from('community_feed_cache').insert([{
                uri: published.uri, cid: published.cid, author_did: creds.did, author_handle: creds.handle, 
                author_display_name: profile?.display_name || creds.handle, author_avatar_url: profile?.avatar_url, 
                post_text: payload.text, embed_image_url: cdnImageUrl, indexed_at: new Date().toISOString()
            }]);
        }

        return new Response(JSON.stringify({ success: true, uri: published.uri, cid: published.cid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      case 'get_post_thread': { // FASE 2: Lectura de hilos
        const bskyUrl = `${pdsUrl}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(payload.uri)}&depth=10`;
        const res = await fetchWithDpop(bskyUrl, 'GET', creds.access_jwt, privateJwk);
        const thread = await res.json();
        return new Response(JSON.stringify(thread), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      // ... (Mantenemos Like, Unlike y Delete como ya estaban) ...
      case 'like_post': {
        const createBody = { repo: creds.did, collection: 'app.bsky.feed.like', record: { $type: 'app.bsky.feed.like', subject: { uri: payload.postUri, cid: payload.postCid }, createdAt: new Date().toISOString() } };
        const bskyResponse = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', creds.access_jwt, privateJwk, createBody);
        const res = await bskyResponse.json();
        return new Response(JSON.stringify({ success: true, uri: res.uri }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      case 'unlike_post': {
        const rkey = payload.likeUri.split('/').pop();
        await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, 'POST', creds.access_jwt, privateJwk, { repo: creds.did, collection: 'app.bsky.feed.like', rkey });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      case 'delete_post': {
        const rkey = payload.postUri.split('/').pop();
        await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, 'POST', creds.access_jwt, privateJwk, { repo: creds.did, collection: 'app.bsky.feed.post', rkey });
        await supabaseAdmin.from('community_feed_cache').delete().eq('uri', payload.postUri);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      default: throw new Error(`Acción '${action}' no soportada.`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})