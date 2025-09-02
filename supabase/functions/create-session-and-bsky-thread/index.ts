// ARCHIVO FINAL Y A PRUEBA DE FALLOS: /supabase/functions/create-session-and-bsky-thread/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
            // --- INICIO DE LA LÓGICA A PRUEBA DE FALLOS ---
            try {
                // 1. Intentamos usar las credenciales del investigador
                console.log(`Intentando conectar como ${creds.handle}...`);
                await agent.resumeSession({ ...creds });
                console.log(`Conexión exitosa como ${creds.handle}.`);
                postText = `📢 ¡Evento programado!\n\n"${sessionData.session_title}"\n\nConoce los detalles y únete al chat aquí:`;
                useUserAgent = true;
            } catch (e) {
                // 2. Si fallan, lo registramos y nos preparamos para usar el bot
                console.warn(`Las credenciales para ${creds.handle} son inválidas o han expirado. Usando bot como respaldo. Error: ${e.message}`);
                useUserAgent = false;
            }
            // --- FIN DE LA LÓGICA A PRUEBA DE FALLOS ---
        }
        
        if (!useUserAgent) {
            // 3. Si no hay credenciales o si fallaron, usamos el bot
            await agent.login({ identifier: Deno.env.get('BSKY_HANDLE')!, password: Deno.env.get('BSKY_APP_PASSWORD')! });
            postText = `📢 ¡Evento programado!\n\n"${sessionData.session_title}"\n\n✍️ Presentado por: ${authorInfo.displayName}\n\nConoce los detalles y únete al chat aquí:`;
        }

        const directLink = `https://epistecnologia.com/live.html?sesion=${savedSession.id}`;
        
        const postRecord = { text: `${postText}\n${directLink}`, createdAt: new Date().toISOString(), langs: ["es"] };
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