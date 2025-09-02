// ARCHIVO FINAL Y CORREGIDO: /supabase/functions/bsky-create-anchor-post/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ... (Tu función getLinkPreview no necesita cambios)

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

        const agent = new BskyAgent({ 
            service: 'https://bsky.social',
            persistSession: async (evt: AtpSessionEvent, session?: AtpSessionData) => {
                if (evt === 'update' && session) {
                  await supabaseClient.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', user.id);
                }
            },
        })
        await agent.resumeSession({ accessJwt: creds.access_jwt, refreshJwt: creds.refresh_jwt, did: creds.did, handle: creds.handle });
        
        const eventDate = new Date(scheduledAt);

        // --- LA CORRECCIÓN ESTÁ AQUÍ ---
        // Usamos la "timezone" enviada por el navegador del investigador para formatear la fecha y hora.
        const formattedDate = eventDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: timezone // Se usa la zona horaria dinámica
        });
        const formattedTime = eventDate.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone, // Se usa la zona horaria dinámica
            timeZoneName: 'short' // Esto generará la abreviatura correcta (ej: PET, EST, CST)
        });
        // --- FIN DE LA CORRECCIÓN ---

        const previewData = await getLinkPreview(directLink);
        let imageBlob = null;
        if (previewData && previewData.thumb) {
            // ... (tu lógica para procesar la imagen no cambia)
        }

        // El texto del post ahora usa la hora y zona horaria correctas, sin "(PE)" fijo.
        const postRecord = {
            text: `📢 ¡Evento programado!\n\n"${sessionTitle}"\n\n🗓️ ${formattedDate}\n⏰ ${formattedTime}\n\nÚnete a la transmisión y al chat en vivo aquí:\n${directLink}`,
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
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
})