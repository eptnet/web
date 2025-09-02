// ARCHIVO FINAL Y DEFINITIVO: /supabase/functions/create-session-and-bsky-thread/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent } from 'npm:@atproto/api'
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
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        const { data: { user } } = await createClient(
            Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        ).auth.getUser();
        if (!user) throw new Error('Usuario no autenticado.');

        const { sessionData, authorInfo, postMethod } = await req.json();
        if (!sessionData || !authorInfo || !postMethod) throw new Error('Faltan datos en la solicitud.');
        
        const { data: savedSession, error: insertError } = await supabaseAdmin.from('sessions').insert(sessionData).select().single();
        if (insertError) throw insertError;

        if (postMethod === 'none') {
            return new Response(JSON.stringify({ success: true, savedSession }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const agent = new BskyAgent({ service: 'https://bsky.social' });
        let postText = '';

        if (postMethod === 'user') {
            const { data: creds } = await supabaseAdmin.from('bsky_credentials').select('*').eq('user_id', user.id).single();
            if (!creds) throw new Error("Se intentó publicar como usuario, pero no se encontraron credenciales.");
            await agent.resumeSession({ ...creds });
            postText = `📢 ¡Evento programado!\n\n"${sessionData.session_title}"\n\nConoce los detalles y únete al chat aquí:`;
        } else if (postMethod === 'bot') {
            await agent.login({ identifier: Deno.env.get('BSKY_HANDLE')!, password: Deno.env.get('BSKY_APP_PASSWORD')! });
            postText = `📢 ¡Evento programado!\n\n"${sessionData.session_title}"\n\n✍️ Presentado por: ${authorInfo.displayName}\n\nConoce los detalles y únete al chat aquí:`;
        }
        
        const directLink = `https://epistecnologia.com/live.html?sesion=${savedSession.id}`;
        
        // --- LÓGICA DE VISTA PREVIA Y MINIATURA ---
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
                console.error("No se pudo procesar la imagen de la miniatura, se publicará sin ella.");
            }
        }

        const postRecord = {
            text: `${postText}\n${directLink}`,
            createdAt: new Date().toISOString(),
            langs: ["es"],
            embed: {
                $type: 'app.bsky.embed.external',
                external: {
                    uri: directLink,
                    title: previewData?.title || sessionData.session_title,
                    description: previewData?.description || 'Evento en vivo de Epistecnología',
                    thumb: imageBlob || undefined
                }
            }
        };
        
        const postResult = await agent.post(postRecord);

        await supabaseAdmin.from('sessions').update({ 
            bsky_chat_thread_uri: postResult.uri, 
            bsky_chat_thread_cid: postResult.cid 
        }).eq('id', savedSession.id);

        return new Response(JSON.stringify({ success: true, savedSession }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error en create-session-and-bsky-thread:', error);
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
})