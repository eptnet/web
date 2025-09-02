import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    // Manejo de solicitud OPTIONS para CORS
    if (req.method === 'OPTIONS') { 
        return new Response('ok', { headers: corsHeaders }) 
    }

    try {
        // 1. Usamos un cliente "Admin" porque esta función es llamada por el servidor (Trigger)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Obtenemos los datos que nos envía el Trigger desde la base de datos
        const { sessionTitle, scheduledAt, sessionId, userId, directLink, timezone } = await req.json();
        if (!userId) {
            throw new Error('El userId es requerido desde el trigger de la base de datos.');
        }

        // 3. Buscamos las credenciales del investigador usando el userId
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
            persistSession: async (evt: AtpSessionEvent, session?: AtpSessionData) => {
                if (evt === 'update' && session) {
                    await supabaseAdmin
                        .from('bsky_credentials')
                        .update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt })
                        .eq('user_id', userId);
                }
            },
        });

        await agent.resumeSession({
            accessJwt: creds.access_jwt,
            refreshJwt: creds.refresh_jwt,
            did: creds.did,
            handle: creds.handle,
        });
        
        const eventDate = new Date(scheduledAt);
        const formattedDate = eventDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone });
        const formattedTime = eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: timezone, timeZoneName: 'short' });
        
        const postRecord = {
            text: `📢 ¡Evento programado!\n\n"${sessionTitle}"\n\n🗓️ ${formattedDate}\n⏰ ${formattedTime}\n\nÚnete a la transmisión y al chat en vivo aquí:\n${directLink}`,
            createdAt: new Date().toISOString(),
            langs: ["es"],
        };
        
        const postResult = await agent.post(postRecord);

        // Actualizamos la sesión en la DB con los datos del hilo de Bluesky
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