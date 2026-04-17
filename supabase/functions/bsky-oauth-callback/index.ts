import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { code, state, redirect_uri } = await req.json()
    const CLIENT_ID = "https://epistecnologia.com/oauth-client-metadata.json"

    // 1. Extraer el Verifier oculto en el state
    const decodedState = JSON.parse(atob(state))
    const code_verifier = decodedState.v

    // 2. Autenticar con Supabase para saber QUÉ usuario está conectando esto
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error("Usuario no autenticado en Supabase.")

    // 3. Canjear el 'code' por Tokens en Bluesky
    const tokenResponse = await fetch("https://bsky.social/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "authorization_code",
        redirect_uri: redirect_uri,
        code: code,
        code_verifier: code_verifier
      })
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      throw new Error(`Error canjeando token de Bluesky: ${err}`)
    }

    const tokens = await tokenResponse.json()
    const did = tokens.sub // El DID viene en el claim 'sub' (Subject)

    // 4. Averiguar el Handle del usuario usando su DID
    const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`)
    let handle = did // Fallback
    if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      handle = profileData.handle
    }

    // 5. Guardar en tu base de datos
    const { error: dbError } = await supabase
      .from('bsky_credentials')
      .upsert({ 
        user_id: user.id, 
        handle: handle, 
        did: did,
        access_jwt: tokens.access_token, 
        refresh_jwt: tokens.refresh_token,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ success: true, handle, did }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})