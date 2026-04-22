// ARCHIVO: /supabase/functions/bot-create-post/index.ts (Con soporte de IMÁGENES)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent } from 'npm:@atproto/api'

const BSKY_SERVICE_URL = 'https://bsky.social'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    // Verificamos autorización
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error("Acción no autorizada: se requiere iniciar sesión.")

    // Recibimos todos los datos (incluyendo la imagen Base64)
    const payload = await req.json()
    const { 
        postText, authorInfo, isBot,
        base64Image, imageMimeType, 
        postLink, linkTitle, linkDescription, linkThumb 
    } = payload;

    if (!postText || !authorInfo) {
        throw new Error("Faltan datos para la publicación (texto y autor).")
    }

    // --- LÓGICA DE ATRIBUCIÓN MEJORADA ---
    let finalPostText = '';
    const { displayName, handle, orcid } = authorInfo;

    if (handle) {
        finalPostText = `${postText}\n\n✍️ por @${handle}`;
    } else {
        const authorName = displayName || 'un investigador de la red';
        const orcidLink = orcid ? orcid.replace('https://', '') : ''; 
        finalPostText = `${postText}\n\n✍️ por ${authorName}\n${orcidLink}`;
    }

    // --- INICIAMOS SESIÓN CON EL BOT ---
    const agent = new BskyAgent({ service: BSKY_SERVICE_URL });
    await agent.login({
      identifier: Deno.env.get('BSKY_HANDLE')!,
      password: Deno.env.get('BSKY_APP_PASSWORD')!,
    });
    
    let embedInfo = undefined;

    // --- 1. PROCESAMIENTO DE IMAGEN ---
    if (base64Image) {
        console.log("Procesando imagen para el Bot...");
        
        // Convertimos el Base64 puro a un arreglo binario (Uint8Array)
        const byteCharacters = atob(base64Image);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
        }

        // Subimos el Blob a Bluesky
        const uploadRes = await agent.uploadBlob(byteArray, { 
            encoding: imageMimeType || 'image/jpeg' 
        });

        if (uploadRes.success) {
            // Preparamos el contenedor de la imagen para el Post
            embedInfo = {
                $type: 'app.bsky.embed.images',
                images: [{
                    alt: linkTitle || 'Imagen compartida desde Epistecnología',
                    image: uploadRes.data.blob
                }]
            };
        }
    } 
    // --- 2. PROCESAMIENTO DE ENLACE (Si no hay imagen) ---
    // --- 2. PROCESAMIENTO DE ENLACE (Para eventos y comunidad) ---
    else if (postLink) {
        embedInfo = {
            $type: 'app.bsky.embed.external',
            external: {
                uri: postLink,
                title: linkTitle || 'Enlace de Epistecnología',
                description: linkDescription || '',
            }
        };
        
        // El Bot también descarga y sube la miniatura como Blob
        if (linkThumb && linkThumb.startsWith('http')) {
            try {
                const thumbRes = await fetch(linkThumb);
                const thumbBuffer = await thumbRes.arrayBuffer();
                const thumbBytes = new Uint8Array(thumbBuffer);
                const mimeType = thumbRes.headers.get('content-type') || 'image/jpeg';
                
                const uploadRes = await agent.uploadBlob(thumbBytes, { encoding: mimeType });
                if (uploadRes.success) {
                    embedInfo.external.thumb = uploadRes.data.blob;
                }
            } catch(e) {
                console.log("Aviso: El bot no pudo subir la miniatura", e);
            }
        }
    }

    // --- PUBLICAMOS EL POST FINAL ---
    const response = await agent.post({ 
        text: finalPostText, 
        embed: embedInfo 
    });

    return new Response(JSON.stringify({ 
        success: true, 
        uri: response.uri,
        cid: response.cid,
        message: "Publicado en la comunidad por el Bot con contenido multimedia." 
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en la función bot-create-post:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500, // Devolvemos 500 para que el front-end lo interprete como fallo
    })
  }
})