import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Creamos un cliente que actúa en nombre del usuario que hace la llamada
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado.')

    // Buscamos si existen credenciales para este usuario
    const { data: creds, error } = await supabaseClient
      .from('bsky_credentials')
      .select('handle')
      .eq('user_id', user.id)
      .single()

    // Si no se encuentran credenciales (error o no hay datos), no está conectado
    if (error || !creds) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Si se encuentran, está conectado
    return new Response(JSON.stringify({ connected: true, handle: creds.handle }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ connected: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})