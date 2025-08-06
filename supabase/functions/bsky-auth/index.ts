import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent } from 'npm:@atproto/api'

// URL del servicio principal de Bluesky
const BSKY_SERVICE_URL = 'https://bsky.social'

console.log("Función bsky-auth iniciada.");

serve(async (req) => {
  // Manejo de la petición pre-vuelo CORS, esencial para la comunicación desde el navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
      } 
    })
  }

  try {
    // 1. Creamos un cliente de Supabase usando el token de autorización del usuario que hace la llamada.
    // Esto asegura que la función actúa en nombre del usuario logueado en Epistecnología.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Obtenemos los datos del usuario para verificar que está autenticado.
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Usuario no autenticado.')
    }

    // 3. Extraemos el handle y la App Password que el frontend nos enviará.
    const { handle, appPassword } = await req.json()
    if (!handle || !appPassword) {
      throw new Error('Se requiere el handle y la App Password de Bluesky.')
    }

    // 4. Creamos un nuevo "Agente" de Bluesky y intentamos iniciar sesión.
    // La App Password se usa aquí y NUNCA se guarda.
    const agent = new BskyAgent({ service: BSKY_SERVICE_URL })
    await agent.login({ identifier: handle, password: appPassword })

    // 5. Si el login es exitoso, la sesión se guarda en el agente. La extraemos.
    const session = agent.session
    if (!session) {
      throw new Error('No se pudo crear una sesión con Bluesky. Verifica tus credenciales.')
    }
    
    // 6. Preparamos los datos para guardarlos en nuestra base de datos.
    // NOTA: Para una seguridad máxima, estos tokens deberían encriptarse usando una clave secreta.
    const credentialsData = {
      user_id: user.id, // Vinculamos los tokens al ID del usuario de Epistecnología
      handle: session.handle,
      did: session.did,
      access_jwt: session.accessJwt,
      refresh_jwt: session.refreshJwt
    }

    // 7. Usamos 'upsert' para guardar o actualizar las credenciales en la tabla.
    // Si el usuario ya tenía credenciales, se sobreescribirán.
    const { error: upsertError } = await supabaseClient
      .from('bsky_credentials')
      .upsert(credentialsData)

    if (upsertError) {
      // Si hay un error guardando, lo lanzamos para que sea capturado por el catch.
      throw upsertError
    }

    // 8. Devolvemos una respuesta de éxito al frontend.
    return new Response(JSON.stringify({ message: '¡Cuenta de Bluesky conectada con éxito!' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en la función bsky-auth:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 400, // Usamos 400 para errores de cliente (ej. credenciales incorrectas)
    })
  }
})