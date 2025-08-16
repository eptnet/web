// ARCHIVO FINAL Y CORREGIDO: /supabase/functions/bsky-create-anchor-post/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

async function getLinkPreview(url: string) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return null;
        const text = await response.text();
        const titleMatch = text.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
        const descriptionMatch = text.match(/<meta\s+property="og:description"\s+content="([^"]*)"/);
        const imageMatch = text.match(/<meta\s+property="og:image"\s+content="([^"]*)"/);
        return {
            title: titleMatch ? titleMatch[1] : 'Título no disponible',
            description: descriptionMatch ? descriptionMatch[1] : 'Descripción no disponible',
            thumb: imageMatch ? imageMatch[1] : undefined,
        };
    } catch (error) {
        console.error(`Error al hacer unfurl del link ${url}:`, error);
        return null;
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error('Usuario no autenticado.')

        const { data: creds, error: credsError } = await supabaseClient.from('bsky_credentials').select('did, handle, access_jwt, refresh_jwt').eq('user_id', user.id).single()
        if (credsError || !creds) throw new Error('El investigador no ha conectado su cuenta de Bluesky.')

        const { sessionTitle, scheduledAt, directLink, timezone } = await req.json()
        if (!sessionTitle || !scheduledAt || !timezone || !directLink) {
            throw new Error('Faltan datos de la sesión.')
        }

        const agent = new BskyAgent({ service: 'https://bsky.social' })
        await agent.resumeSession({ accessJwt: creds.access_jwt, refreshJwt: creds.refresh_jwt, did: creds.did, handle: creds.handle });
        
        const eventDate = new Date(scheduledAt);
        const formattedDate = eventDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone });
        const formattedTime = eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: timezone, timeZoneName: 'short' });

        const previewData = await getLinkPreview(directLink);
        let imageBlob = null;

        if (previewData && previewData.thumb) {
            try {
                const imageResponse = await fetch(previewData.thumb);
                if (imageResponse.ok) {
                    const imageData = await imageResponse.arrayBuffer();
                    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                    
                    const uploadResult = await agent.uploadBlob(new Uint8Array(imageData), {
                        encoding: contentType
                    });
                    
                    // --- LA CORRECCIÓN DEFINITIVA ESTÁ AQUÍ ---
                    // Extraemos el objeto 'blob' del interior de la respuesta 'data'
                    imageBlob = uploadResult.data.blob;
                }
            } catch (imgError) {
                console.error("No se pudo procesar la imagen de la miniatura, se publicará sin ella:", imgError.message);
            }
        }

        const postRecord = {
            text: `📢 ¡Evento programado!\n"${sessionTitle}"\n\n🗓️ ${formattedDate}\n⏰ ${formattedTime}\n\nÚnete a la transmisión y al chat en vivo aquí:\n${directLink}`,
            createdAt: new Date().toISOString(),
            langs: ["es"],
            embed: previewData ? {
                $type: 'app.bsky.embed.external',
                external: {
                    uri: directLink,
                    title: previewData.title,
                    description: previewData.description,
                    thumb: imageBlob || undefined
                }
            } : undefined
        };
        
        const postResult = await agent.post(postRecord);

        return new Response(JSON.stringify({ uri: postResult.uri, cid: postResult.cid }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        })
    } catch (error) {
        console.error('Error en bsky-create-anchor-post:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
})