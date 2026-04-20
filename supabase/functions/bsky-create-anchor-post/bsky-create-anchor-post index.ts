// ARCHIVO FINAL Y DEFINITIVO: /supabase/functions/bsky-create-anchor-post/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Función auxiliar para obtener la vista previa del enlace (unfurl)
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
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { sessionTitle, sessionId, userId, directLink } = await req.json();
        if (!sessionTitle || !sessionId || !userId || !directLink) {
            throw new Error('Faltan datos de la sesión (title, id, userId, link).');
        }

        const { data: creds, error: credsError } = await supabaseAdmin.from('bsky_credentials').select('did, handle, access_jwt, refresh_jwt').eq('user_id', userId).single();
        if (credsError || !creds) throw new Error('El investigador no ha conectado su cuenta de Bluesky.');

        const agent = new BskyAgent({
            service: 'https://bsky.social',
            persistSession: async (evt: AtpSessionEvent, session?: AtpSessionData) => {
                if (evt === 'update' && session) {
                    await supabaseAdmin.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', userId);
                }
            },
        });
        await agent.resumeSession({ accessJwt: creds.access_jwt, refreshJwt: creds.refresh_jwt, did: creds.did, handle: creds.handle });
        
        const previewData = await getLinkPreview(directLink);
        let imageBlob = null;
        if (previewData && previewData.thumb) {
            try {
                const imageResponse = await fetch(previewData.thumb);
                if (imageResponse.ok) {
                    const imageData = await imageResponse.arrayBuffer();
                    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                    const uploadResult = await agent.uploadBlob(new Uint8Array(imageData), { encoding: contentType });
                    imageBlob = uploadResult.data.blob;
                }
            } catch (imgError) {
                console.error("No se pudo procesar la imagen de la miniatura, se publicará sin ella:", imgError.message);
            }
        }

        // Usamos tu nuevo texto, más simple y robusto
        const postRecord = {
            text: `🔴 ¡EVENTO EN VIVO!\n\n"${sessionTitle}"\n\nÚnete a la conversación en #eptlive. Conoce todos los detalles en la descripción.\n#DivulgaciónCientífica`,
            createdAt: new Date().toISOString(),
            langs: ["es"],
            embed: {
                $type: 'app.bsky.embed.external',
                external: {
                    uri: directLink,
                    title: previewData?.title || sessionTitle,
                    description: previewData?.description || 'Evento en vivo de Epistecnología',
                    thumb: imageBlob || undefined
                }
            }
        };
        
        const postResult = await agent.post(postRecord);

        await supabaseAdmin.from('sessions').update({ 
            bsky_chat_thread_uri: postResult.uri, 
            bsky_chat_thread_cid: postResult.cid 
        }).eq('id', sessionId);

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error en bsky-create-anchor-post:', error);
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
})