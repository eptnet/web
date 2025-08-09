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

    // 3. RECIBIR DATOS DEL POST AL QUE SE DARÁ LIKE
    const { postUri, postCid } = await req.json()
    if (!postUri || !postCid) throw new Error('Faltan datos del post (URI y CID).')

    // 4. CREAR AGENTE DE BLUESKY Y MANEJAR SESIÓN (INCLUYE AUTO-REFRESCO DE TOKEN)
    const agent = new BskyAgent({
      service: BSKY_SERVICE_URL,
      // Esta función es crucial: si el token de sesión expira, la librería lo refrescará
      // automáticamente y nos avisará para que guardemos el nuevo token en la base de datos.
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          console.log('Refrescando token de sesión para el usuario:', user.id)
          await supabaseClient
            .from('bsky_credentials')
            .update({
              access_jwt: session.accessJwt,
              refresh_jwt: session.refreshJwt,
            })
            .eq('user_id', user.id)
        }
      },
    })

    // Reanudamos la sesión con los tokens que teníamos guardados
    await agent.resumeSession({
      accessJwt: creds.access_jwt,
      refreshJwt: creds.refresh_jwt,
      did: creds.did,
      handle: creds.handle,
    })

    // 5. EJECUTAR LA ACCIÓN: DAR "ME GUSTA"
    await agent.like(postUri, postCid)

    // 6. DEVOLVER RESPUESTA DE ÉXITO
    return new Response(JSON.stringify({ success: true, message: 'Post likeado con éxito' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en la función bsky-like-post:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})