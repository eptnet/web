import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'

const BSKY_SERVICE_URL = 'https://bsky.social'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. AUTENTICACIÓN DEL USUARIO DE EPISTECNOLOGÍA
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado.')

    // 2. OBTENER CREDENCIALES DE BLUESKY GUARDADAS
    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('access_jwt, refresh_jwt, did, handle')
      .eq('user_id', user.id)
      .single()
    if (credsError || !creds) throw new Error('El usuario no ha conectado su cuenta de Bluesky.')

    // 3. RECIBIR DATOS DEL COMENTARIO
    const { replyText, parentPost } = await req.json()
    if (!replyText || !parentPost || !parentPost.uri || !parentPost.cid) {
      throw new Error('Faltan datos para publicar el comentario (texto y referencia del post padre).')
    }

    // 4. CREAR AGENTE DE BLUESKY Y MANEJAR SESIÓN (CON AUTO-REFRESCO)
    const agent = new BskyAgent({
      service: BSKY_SERVICE_URL,
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          await supabaseClient
            .from('bsky_credentials')
            .update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt })
            .eq('user_id', user.id)
        }
      },
    })
    await agent.resumeSession({ ...creds })

    // 5. EJECUTAR LA ACCIÓN: PUBLICAR EL COMENTARIO (REPLY)
    await agent.post({
      text: replyText,
      reply: {
        root: { uri: parentPost.uri, cid: parentPost.cid }, // El post original del hilo
        parent: { uri: parentPost.uri, cid: parentPost.cid } // El post al que respondemos directamente
      }
    })

    // 6. DEVOLVER RESPUESTA DE ÉXITO
    return new Response(JSON.stringify({ success: true, message: 'Comentario publicado con éxito' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en la función bsky-create-reply:", error);
    // --- INICIO DE LA MEJORA ---
    if (error.error === 'InvalidToken' || error.message === 'Token could not be verified') {
        return new Response(JSON.stringify({ 
            error: 'Tu sesión de Bluesky ha expirado. Por favor, desconecta y vuelve a conectar tu cuenta en tu perfil.' 
        }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    // --- FIN DE LA MEJORA ---
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})