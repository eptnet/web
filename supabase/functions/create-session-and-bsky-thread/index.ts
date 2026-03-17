// ARCHIVO FINAL: /supabase/functions/create-session-and-bsky-thread/index.ts

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
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        const { data: { user } } = await createClient(
            Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        ).auth.getUser();
        if (!user) throw new Error('Usuario no autenticado.');

        const { sessionData, authorInfo } = await req.json();
        if (!sessionData || !authorInfo) throw new Error('Faltan datos de la sesión o del autor.');
        
        const { data: savedSession, error: insertError } = await supabaseAdmin.from('sessions').insert(sessionData).select().single();
        if (insertError) throw insertError;

        const { data: creds } = await supabaseAdmin.from('bsky_credentials').select('*').eq('user_id', user.id).single();
        
        const agent = new BskyAgent({ service: 'https://bsky.social' });
        let postText = '';
        let useUserAgent = false;

        if (creds) {
            try {
                await agent.resumeSession({
                    accessJwt: creds.access_jwt,
                    refreshJwt: creds.refresh_jwt,
                    did: creds.did,
                    handle: creds.handle,
                });
                postText = `📢 ¡Evento programado!\n\n"${sessionData.session_title}"\n\nConoce los detalles y únete al chat aquí:`;
                useUserAgent = true;
            } catch (e) {
                console.warn(`Las credenciales para ${creds.handle} son inválidas. Usando bot como respaldo. Error: ${e.message}`);
                useUserAgent = false;
            }
        }
        
        if (!useUserAgent) {
            await agent.login({ identifier: Deno.env.get('BSKY_HANDLE')!, password: Deno.env.get('BSKY_APP_PASSWORD')! });
            postText = `📢 ¡Evento programado!\n\n"${sessionData.session_title}"\n\n✍️ Presentado por: ${authorInfo.displayName}\n\nConoce los detalles y únete al chat aquí:`;
        }

        const directLink = `https://epistecnologia.com/l/${savedSession.id}`;
        
        // --- LÓGICA DE VISTA PREVIA Y MINIATURA CORREGIDA ---
        // 1. Usamos la imagen de ImgBB que nos mandó el frontend
        let finalThumbUrl = sessionData.thumbnail_url; 
        let previewData = null;

        // 2. Si por algún motivo no hay imagen de ImgBB, hacemos el escaneo de respaldo
        if (!finalThumbUrl) {
            previewData = await getLinkPreview(directLink);
            finalThumbUrl = previewData?.thumb;
        }

        let imageBlob = null;
        if (finalThumbUrl) {
            try {
                const imageResponse = await fetch(finalThumbUrl);
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
                    title: sessionData.session_title, // Usamos el título real que el usuario escribió
                    description: sessionData.description || previewData?.description || 'Evento en vivo de Epistecnología',
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