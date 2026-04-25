// /supabase/functions/bsky-lexicon-api/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts" 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- UTILIDADES CRIPTOGRÁFICAS ---
async function generateDpopProof(htu: string, htm: string, privateJwk: any, nonce?: string, accessToken?: string) {
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y };
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload: any = { jti: crypto.randomUUID(), htm, htu, iat: Math.floor(Date.now() / 1000) };
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
  return `${headerB64}.${payloadB64}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;
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
  const newNonce = res.headers.get('dpop-nonce');
  if ((res.status === 401 || res.status === 400) && newNonce) {
    res = await makeRequest(newNonce); 
  }
  return res;
}

// --- MOTOR DE REFRESCO ---
async function refreshBskyToken(supabase: any, userId: string, refreshToken: string, privateJwk: any) {
    const tokenUrl = 'https://bsky.social/oauth/token';
    const dpopProof = await generateDpopProof(tokenUrl, 'POST', privateJwk);
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', 'https://epistecnologia.com/oauth-client-metadata.json');

    const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'DPoP': dpopProof },
        body: params.toString()
    });
    if (!res.ok) throw new Error("Sesión expirada definitivamente. Por favor reconecta Bluesky.");
    const data = await res.json();
    const newRefreshData = { token: data.refresh_token, jwk: privateJwk };
    await supabase.from('bsky_credentials').update({
        access_jwt: data.access_token,
        refresh_jwt: JSON.stringify(newRefreshData),
        updated_at: new Date().toISOString()
    }).eq('user_id', userId);
    return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json();

    // 1. LECTURA PÚBLICA (Accesible para invitados)
    if (payload.action === 'get_post_thread') {
         const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(payload.uri)}`;
         const bskyResponse = await fetch(url);
         return new Response(await bskyResponse.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // 2. AUTENTICACIÓN SUPABASE
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("No autorizado");

    const { data: creds } = await supabaseClient.from('bsky_credentials').select('*').eq('user_id', user.id).single();
    if (!creds) throw new Error("Credenciales de Bluesky no encontradas en DB");

    const refreshData = JSON.parse(creds.refresh_jwt);
    const privateJwk = refreshData.jwk;
    let accessToken = creds.access_jwt;

    // 3. RESOLVER PDS
    let pdsUrl = 'https://bsky.social'; 
    try {
      if (creds.did.startsWith('did:plc:')) {
        const didRes = await fetch(`https://plc.directory/${creds.did}`);
        const didDoc = await didRes.json();
        const pdsService = didDoc.service?.find((s: any) => s.id === '#atproto_pds');
        if (pdsService) pdsUrl = pdsService.serviceEndpoint;
      }
    } catch (e) { console.log("PDS fallback"); }

    // --- MOTOR DE EJECUCIÓN ---
    const executeAction = async (token: string) => {
        switch (payload.action) {
            case 'create_post':
            case 'create_reply': {
                let embed: any = undefined;

                // IMÁGENES
                if (payload.imageBase64) {
                    const byteArray = base64Decode(payload.imageBase64);
                    const uploadRes = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, 'POST', token, privateJwk, byteArray, undefined, payload.imageMimeType || 'image/jpeg');
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        embed = { $type: 'app.bsky.embed.images', images: [{ alt: payload.linkTitle || 'Imagen EPT', image: uploadData.blob }] };
                    }
                } 
                // ENLACES / MINIATURAS
                else if (payload.postLink) {
                    embed = { $type: 'app.bsky.embed.external', external: { uri: payload.postLink, title: payload.linkTitle || 'Enlace', description: payload.linkDescription || '' } };
                    if (payload.linkThumb && payload.linkThumb.startsWith('http')) {
                        const tRes = await fetch(payload.linkThumb);
                        const tBuffer = await tRes.arrayBuffer();
                        const uRes = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, 'POST', token, privateJwk, new Uint8Array(tBuffer), undefined, 'image/jpeg');
                        if (uRes.ok) { embed.external.thumb = (await uRes.json()).blob; }
                    }
                }

                const record: any = { text: payload.text || '', createdAt: new Date().toISOString(), embed };
                if (payload.action === 'create_reply') {
                    record.reply = {
                        root: { uri: payload.replyTo.rootUri, cid: payload.replyTo.rootCid },
                        parent: { uri: payload.replyTo.parentUri, cid: payload.replyTo.parentCid }
                    };
                }

                return await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', token, privateJwk, {
                    repo: creds.did, collection: 'app.bsky.feed.post', record
                });
            }

            case 'delete_post': {
                const rkey = payload.postUri.split('/').pop();
                const res = await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, 'POST', token, privateJwk, { repo: creds.did, collection: 'app.bsky.feed.post', rkey });
                if (res.ok) {
                    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                    await admin.from('community_feed_cache').delete().eq('uri', payload.postUri);
                }
                return res;
            }

            case 'like_post':
            case 'unlike_post': {
                 const isLike = payload.action === 'like_post';
                 const collection = 'app.bsky.feed.like';
                 if (isLike) {
                     return await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, 'POST', token, privateJwk, {
                         repo: creds.did, collection, record: { subject: { uri: payload.postUri, cid: payload.postCid }, createdAt: new Date().toISOString() }
                     });
                 } else {
                     const rkey = payload.likeUri.split('/').pop();
                     return await fetchWithDpop(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, 'POST', token, privateJwk, { repo: creds.did, collection, rkey });
                 }
            }
            default: throw new Error("Acción no soportada");
        }
    };

    // EJECUCIÓN CON AUTO-REFRESCO
    let response = await executeAction(accessToken);
    if (response.status === 401) {
        accessToken = await refreshBskyToken(supabaseClient, user.id, refreshData.token, privateJwk);
        response = await executeAction(accessToken);
    }

    const result = await response.text();
    return new Response(result, { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});