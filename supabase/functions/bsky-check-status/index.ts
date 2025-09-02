// Contenido CORREGIDO para: /supabase/functions/bsky-check-status/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) { return new Response(JSON.stringify({ connected: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}) }

    const { data: creds, error } = await supabaseClient.from('bsky_credentials').select('did, handle, access_jwt, refresh_jwt').eq('user_id', user.id).single()
    if (error || !creds) { return new Response(JSON.stringify({ connected: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}) }

    const agent = new BskyAgent({
      service: 'https://bsky.social',
      persistSession: async (evt: AtpSessionEvent, session?: AtpSessionData) => {
        if (evt === 'update' && session) {
          await supabaseClient.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', user.id)
        }
      }
    })

    // --- LA CORRECCIÓN ESTÁ AQUÍ ---
    // Mapeamos manualmente los nombres de las credenciales al formato correcto.
    await agent.resumeSession({
      accessJwt: creds.access_jwt,
      refreshJwt: creds.refresh_jwt,
      did: creds.did,
      handle: creds.handle,
    })
    // --- FIN DE LA CORRECCIÓN ---

    return new Response(JSON.stringify({ connected: true, handle: creds.handle }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  } catch (error) {
    console.error('Fallo en la verificación de estado de Bluesky:', error.message)
    return new Response(JSON.stringify({ connected: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
})