import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent } from 'npm:@atproto/api'

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado.')

    // --- INICIO DE LA MODIFICACIÓN 1: Obtener el perfil del usuario ---
    // Necesitamos consultar la tabla 'profiles' para saber el rol del usuario.
    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) throw new Error('No se pudo encontrar el perfil del usuario.');
    // --- FIN DE LA MODIFICACIÓN 1 ---

    const { handle, appPassword } = await req.json()
    if (!handle || !appPassword) throw new Error('Se requiere el handle y la App Password de Bluesky.')

    const agent = new BskyAgent({ service: BSKY_SERVICE_URL })
    await agent.login({ identifier: handle, password: appPassword })

    const session = agent.session
    if (!session) throw new Error('No se pudo crear una sesión con Bluesky. Verifica tus credenciales.')
    
    const credentialsData = {
      user_id: user.id,
      handle: session.handle,
      did: session.did,
      access_jwt: session.accessJwt,
      refresh_jwt: session.refreshJwt
    }

    const { error: upsertError } = await supabaseClient
      .from('bsky_credentials')
      .upsert(credentialsData)

    if (upsertError) throw upsertError

    // --- INICIO DE LA MODIFICACIÓN 2: Añadir a la comunidad si es researcher o admin ---
    // Comprobamos el rol que obtuvimos al principio.
    if (profile.role === 'researcher' || profile.role === 'admin') {
      const { error: communityInsertError } = await supabaseClient
        .from('community_members')
        .upsert(
          { did: session.did, handle: session.handle },
          { onConflict: 'did' } // Si el DID ya existe, no hace nada o actualiza.
        );
      
      if (communityInsertError) {
        // Si falla, solo lo registramos en la consola pero no detenemos el proceso
        // ya que la conexión principal fue exitosa.
        console.error("Error al añadir a la comunidad:", communityInsertError.message);
      } else {
        console.log(`Usuario ${session.handle} añadido/actualizado en la comunidad.`);
      }
    }
    // --- FIN DE LA MODIFICACIÓN 2 ---

    return new Response(JSON.stringify({ message: '¡Cuenta de Bluesky conectada con éxito!' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en la función bsky-auth:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})