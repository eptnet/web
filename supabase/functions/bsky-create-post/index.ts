// ARCHIVO UNIFICADO Y SEGURO: supabase/functions/bsky-create-post/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData, RichText } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Buffer } from "https://deno.land/std@0.170.0/node/buffer.ts";

const BSKY_SERVICE_URL = 'https://bsky.social'

// Función para previsualizar URLs (Tarjetas)
async function getLinkPreview(url: string) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return null;
        const text = await response.text();
        const titleMatch = text.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
        const descriptionMatch = text.match(/<meta\s+property="og:description"\s+content="([^"]*)"/);
        const imageMatch = text.match(/<meta\s+property="og:image"\s+content="([^"]*)"/);
        return {
            title: titleMatch ? titleMatch[1] : 'Enlace externo',
            description: descriptionMatch ? descriptionMatch[1] : '',
            thumb: imageMatch ? imageMatch[1] : undefined,
        };
    } catch (error) { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log("bsky-create-post: Iniciando...");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error("Usuario no autenticado.")

    const { data: creds, error: credsError } = await supabaseClient.from('bsky_credentials').select('*').eq('user_id', user.id).single()
    if (credsError || !creds) throw new Error("Credenciales de Bluesky no encontradas.")

    // Ahora recibimos todo: Texto, Enlace y/o Imagen Base64
    const { postText, postLink, base64Image, imageMimeType } = await req.json()
    if (!postText && !base64Image) throw new Error("El post debe contener texto o una imagen.")

    const agent = new BskyAgent({
      service: BSKY_SERVICE_URL,
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          await supabaseClient.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', user.id)
        }
      },
    })

    await agent.resumeSession({ accessJwt: creds.access_jwt, refreshJwt: creds.refresh_jwt, did: creds.did, handle: creds.handle });
    
    // 1. Detectar menciones y hashtags en el texto
    const rt = new RichText({ text: postText });
    await rt.detectFacets(agent);
    
    let finalEmbed = undefined;

    // 2. Prioridad A: Si envían una IMAGEN DIRECTA (Tu código estable)
    if (base64Image && imageMimeType) {
        console.log("Procesando imagen subida directamente...");
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const uploadResult = await agent.uploadBlob(imageBuffer, { encoding: imageMimeType });
        
        finalEmbed = {
            $type: 'app.bsky.embed.images',
            images: [{ image: uploadResult.data.blob, alt: 'Imagen desde Epistecnología' }]
        };
    } 
    // 3. Prioridad B: Si envían un ENLACE para crear Tarjeta Web (El código nuevo)
    else if (postLink) {
        console.log("Procesando enlace para generar tarjeta...");
        const previewData = await getLinkPreview(postLink);
        let imageBlob = undefined;
        
        if (previewData && previewData.thumb) {
            try {
                const imageResponse = await fetch(previewData.thumb);
                if (imageResponse.ok) {
                    const uploadResult = await agent.uploadBlob(new Uint8Array(await imageResponse.arrayBuffer()), { encoding: imageResponse.headers.get('content-type') || 'image/jpeg' });
                    imageBlob = uploadResult.data.blob;
                }
            } catch (e) { console.error("Error subiendo miniatura del link:", e); }
        }

        finalEmbed = {
            $type: 'app.bsky.embed.external',
            external: {
                uri: postLink,
                title: previewData?.title || 'Leer más en Epistecnología',
                description: previewData?.description || 'Haz clic para ver el artículo.',
                thumb: imageBlob
            }
        };
    }

    console.log("Publicando post...");
    await agent.post({ 
        text: rt.text,
        facets: rt.facets, // Hashtags y Menciones
        embed: finalEmbed, // Imagen o Tarjeta
        createdAt: new Date().toISOString(),
        langs: ["es"]
    })

    return new Response(JSON.stringify({ message: "Post publicado con éxito" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    console.error('Error en bsky-create-post:', error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})