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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // AHORA RECIBIMOS EL HOST ORIGIN (ej. https://tuweb.com) EN LUGAR DEL LINK ARMADO
    const { sessionData, hostOrigin, previewData } = await req.json()

    // 1. Guardar la sesión en la base de datos (Supabase le asignará un ID numérico aquí)
    const { data: savedSession, error: saveError } = await supabaseClient
      .from('sessions')
      .insert([sessionData])
      .select()
      .single()

    if (saveError) {
      throw new Error(`RECHAZADO POR BASE DE DATOS: ${saveError.message}. Detalles: ${saveError.details || 'Ninguno'}`);
    }

    // 🔗 2. ¡AQUÍ ARMAMOS EL LINK DIRECTO CON EL ID REAL (BIGINT)!
    const directLink = `${hostOrigin}/l/${savedSession.id}`;

    // 3. Intentar publicar en Bluesky
    let postResultUri = null;
    let postResultCid = null;

    try {
      const payloadBluesky = {
        action: 'create_post',
        text: `🎙️ ¡Nuevo evento en vivo!\n\n"${sessionData.session_title}"\n\nÚnete a la conversación aquí:`,
        postLink: directLink,
        linkTitle: previewData.title,
        linkDescription: previewData.description,
        linkThumb: previewData.thumb
      }

      const { data: bskyData, error: bskyError } = await supabaseClient.functions.invoke('bsky-lexicon-api', { body: payloadBluesky })

      if (!bskyError && bskyData && bskyData.uri) {
        postResultUri = bskyData.uri
        postResultCid = bskyData.cid
      } else {
        throw new Error("Fallo OAuth, intentando Bot...")
      }

    } catch (e) {
      const { data: botData } = await supabaseClient.functions.invoke('bot-create-post', {
        body: {
          postText: `🎙️ ¡Nuevo evento en vivo!\n\n"${sessionData.session_title}"\n\nÚnete aquí:`,
          postLink: directLink,
          linkTitle: previewData.title,
          linkDescription: previewData.description || 'Únete al Ágora de Epistecnología',
          linkThumb: previewData.thumb,
          isBot: true,
          authorInfo: { displayName: "Epistecnología Live", handle: null }
        }
      })
      if (botData && botData.uri) {
        postResultUri = botData.uri
        postResultCid = botData.cid
      }
    }

    // 4. Actualizar la sesión
    if (postResultUri) {
      await supabaseClient.from('sessions').update({ bsky_chat_thread_uri: postResultUri, bsky_chat_thread_cid: postResultCid }).eq('id', savedSession.id)
    }

    return new Response(JSON.stringify({ success: true, savedSession }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  }
})