// /supabase/functions/crear-enlace-twitch/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }})
  }

  try {
    const { session_id } = await req.json()
    if (!session_id) throw new Error("No se proporcionó session_id.")

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const twitchKey = Deno.env.get('TWITCH_STREAM_KEY')
    if (!twitchKey) throw new Error("La clave de transmisión de Twitch no está configurada.")

    const { data: sessionData, error: sessionError } = await supabaseClient
      .from('sessions')
      .select('director_url') // Obtenemos la URL que contiene el roomName
      .eq('id', session_id)
      .single()

    if (sessionError || !sessionData) throw new Error("No se pudo encontrar la sesión.")

    const directorUrl = new URL(sessionData.director_url)
    const roomName = directorUrl.searchParams.get('room')
    if (!roomName) throw new Error("No se pudo encontrar el nombre de la sala (roomName).")

    const vdoDomain = 'https://vdo.epistecnologia.com'
    const twitchUrl = `${vdoDomain}/?room=${roomName}&whippush=twitch&whippushtoken=${twitchKey}&cleanviewer&record`

    return new Response(
      JSON.stringify({ twitch_url: twitchUrl }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        status: 200 
      }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        status: 400 
      }
    )
  }
})