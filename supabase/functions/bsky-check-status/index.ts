// /supabase/functions/bsky-check-status/index.ts
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

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ connected: false }), { headers: corsHeaders })

    // Verificamos si existen credenciales de Bluesky para este usuario
    const { data: creds, error } = await supabaseClient
      .from('bsky_credentials')
      .select('handle')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !creds) {
      return new Response(JSON.stringify({ connected: false }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Si existen, devolvemos que está conectado y su handle
    return new Response(JSON.stringify({ connected: true, handle: creds.handle }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ connected: false, error: error.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Devolvemos 200 para que el frontend maneje el "no conectado" tranquilamente
    });
  }
})