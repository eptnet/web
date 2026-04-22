// /supabase/functions/create-session-and-bsky-thread/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const authHeader = req.headers.get('Authorization')!;
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const { sessionData, directLink, previewData } = await req.json();

        // 1. Guardar la sesión en Supabase
        const { data: savedSession, error: dbError } = await supabaseAdmin.from('sessions').insert(sessionData).select().single();
        if (dbError) throw dbError;

        // 2. Preparar el post para la comunidad y Bluesky
        const bskyPayload = {
            action: 'create_post',
            text: `🔴 ¡NUEVA SESIÓN! "${sessionData.session_title}"\n\nÚnete a la conversación en el Ágora de Epistecnología.\n#DivulgaciónCientífica`,
            postLink: directLink,
            linkTitle: previewData?.title || sessionData.session_title,
            linkThumb: previewData?.thumb || undefined
        };

        let threadUri = null;
        let threadCid = null;

        // 3. Intento de publicación con Identidad del Investigador (vía Microservicio)
        try {
            const { data: lexData, error: lexError } = await supabaseClient.functions.invoke('bsky-lexicon-api', { body: bskyPayload });
            if (lexError || (lexData && lexData.error)) throw new Error("Fallback al Bot");
            threadUri = lexData.uri;
            threadCid = lexData.cid;
        } catch {
            // Plan B: Publicación vía EPT Bot (Fallback)
            const { data: botData } = await supabaseClient.functions.invoke('bot-create-post', { body: { ...bskyPayload, isBot: true } });
            if (botData?.uri) {
                threadUri = botData.uri;
                threadCid = botData.cid;
            }
        }

        // 4. Actualizar la sesión con el hilo creado
        if (threadUri) {
            await supabaseAdmin.from('sessions').update({ bsky_chat_thread_uri: threadUri, bsky_chat_thread_cid: threadCid }).eq('id', savedSession.id);
        }

        return new Response(JSON.stringify({ success: true, savedSession }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
})