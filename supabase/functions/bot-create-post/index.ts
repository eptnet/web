// ARCHIVO: /supabase/functions/bot-create-post/index.ts (Soporte Multi-Bot e Hilos)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent } from 'npm:@atproto/api'

const BSKY_SERVICE_URL = 'https://bsky.social'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error("Acción no autorizada: se requiere iniciar sesión.")

    const payload = await req.json()
    const { 
        postText, authorInfo, botType, replyTo, // Nuevas variables para el motor de cursos
        base64Image, imageMimeType, postLink, linkTitle, linkDescription, linkThumb 
    } = payload;

    if (!postText || !authorInfo) throw new Error("Faltan datos para la publicación (texto y autor).")

    // --- LÓGICA DE ATRIBUCIÓN ---
    let finalPostText = '';
    // Si botType es 'cursos', hacemos un post más limpio sin la atribución tan grande
    if (botType === 'cursos') {
        finalPostText = postText; 
    } else {
        const { displayName, handle, orcid } = authorInfo;
        if (handle) {
            finalPostText = `${postText}\n\n✍️ por @${handle}`;
        } else {
            const authorName = displayName || 'un investigador de la red';
            finalPostText = `${postText}\n\n✍️ por ${authorName}`;
        }
    }

    // --- SELECCIÓN DEL BOT ---
    let identifier = Deno.env.get('BSKY_HANDLE')!;
    let password = Deno.env.get('BSKY_APP_PASSWORD')!;

    if (botType === 'cursos') {
        identifier = Deno.env.get('CURSOS_BSKY_HANDLE')!;
        password = Deno.env.get('CURSOS_BSKY_APP_PASSWORD')!;
    }

    // --- INICIAMOS SESIÓN CON EL BOT SELECCIONADO ---
    const agent = new BskyAgent({ service: BSKY_SERVICE_URL });
    await agent.login({ identifier, password });
    
    let embedInfo = undefined;

    // Procesamiento de Imagen (Mantenemos tu lógica intacta)
    if (base64Image) {
        const byteCharacters = atob(base64Image);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
        const uploadRes = await agent.uploadBlob(byteArray, { encoding: imageMimeType || 'image/jpeg' });
        if (uploadRes.success) {
            embedInfo = { $type: 'app.bsky.embed.images', images: [{ alt: linkTitle || 'Imagen EPT', image: uploadRes.data.blob }] };
        }
    } 
    // Procesamiento de Enlaces (Mantenemos tu lógica intacta)
    else if (postLink) {
        embedInfo = { $type: 'app.bsky.embed.external', external: { uri: postLink, title: linkTitle || 'Enlace', description: linkDescription || '' } };
        if (linkThumb && linkThumb.startsWith('http')) {
            try {
                const thumbRes = await fetch(linkThumb);
                const uploadRes = await agent.uploadBlob(new Uint8Array(await thumbRes.arrayBuffer()), { encoding: thumbRes.headers.get('content-type') || 'image/jpeg' });
                if (uploadRes.success) embedInfo.external.thumb = uploadRes.data.blob;
            } catch(e) { console.log("Error miniatura", e); }
        }
    }

    // --- CONSTRUCCIÓN DEL POST (Con soporte para Hilos) ---
    const postRecord: any = { text: finalPostText };
    if (embedInfo) postRecord.embed = embedInfo;
    
    // Si nos pasan un replyTo, anidamos este post como respuesta
    if (replyTo && replyTo.rootUri && replyTo.parentUri) {
        postRecord.reply = {
            root: { uri: replyTo.rootUri, cid: replyTo.rootCid },
            parent: { uri: replyTo.parentUri, cid: replyTo.parentCid }
        };
    }

    // --- PUBLICAMOS EL POST ---
    const response = await agent.post(postRecord);

    return new Response(JSON.stringify({ 
        success: true, 
        uri: response.uri,
        cid: response.cid
    }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    console.error("Error en bot-create-post:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 500
    })
  }
})