// ARCHIVO FINAL Y CORREGIDO: /supabase/functions/bsky-create-anchor-post/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { sessionTitle, scheduledAt, sessionId, userId, directLink } = await req.json();
        if (!sessionTitle || !scheduledAt || !sessionId || !userId || !directLink) {
            throw new Error('Faltan datos de la sesión (title, date, id, userId, link).');
        }

        const { data: creds, error: credsError } = await supabaseAdmin
            .from('bsky_credentials')
            .select('did, handle, access_jwt, refresh_jwt')
            .eq('user_id', userId)
            .single();
            
        if (credsError || !creds) {
            console.error(`No se encontraron credenciales de Bluesky para el usuario: ${userId}`);
            throw new Error('El investigador no ha conectado su cuenta de Bluesky.');
        }

        const agent = new BskyAgent({
            service: 'https://bsky.social',
            // --- LA CORRECCIÓN ESTÁ AQUÍ ---
            // Añadimos el callback para que la biblioteca pueda guardar los tokens actualizados.
            persistSession: async (evt: AtpSessionEvent, session?: AtpSessionData) => {
                if (evt === 'update' && session) {
                    console.log(`Actualizando tokens de sesión de Bluesky para el usuario ${userId}`);
                    await supabaseAdmin
                        .from('bsky_credentials')
                        .update({
                            access_jwt: session.accessJwt,
                            refresh_jwt: session.refreshJwt
                        })
                        .eq('user_id', userId);
                }
            },
            // --- FIN DE LA CORRECCIÓN ---
        });

        await agent.resumeSession({
            accessJwt: creds.access_jwt,
            refreshJwt: creds.refresh_jwt,
            did: creds.did,
            handle: creds.handle,
        });
        
        const eventDate = new Date(scheduledAt);
        const formattedDate = eventDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const formattedTime = eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
        
        const postRecord = {
            text: `📢 ¡Evento programado!\n\n"${sessionTitle}"\n\n🗓️ ${formattedDate}\n⏰ ${formattedTime} (PE)\n\nÚnete a la transmisión y al chat en vivo aquí:\n${directLink}`,
            createdAt: new Date().toISOString(),
            langs: ["es"],
        };
        
        const postResult = await agent.post(postRecord);

        await supabaseAdmin.from('sessions').update({ 
            bsky_chat_thread_uri: postResult.uri, 
            bsky_chat_thread_cid: postResult.cid 
        }).eq('id', sessionId);

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        });

    } catch (error) {
        console.error('Error en bsky-create-anchor-post:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
})