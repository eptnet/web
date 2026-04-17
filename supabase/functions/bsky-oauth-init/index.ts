import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { redirect_uri } = await req.json()
    const CLIENT_ID = "https://epistecnologia.com/oauth-client-metadata.json" // Cambia si usas otro dominio

    // 1. Generar PKCE (Seguridad)
    const verifierArray = new Uint8Array(32)
    crypto.getRandomValues(verifierArray)
    const code_verifier = base64UrlEncode(verifierArray)

    const encoder = new TextEncoder()
    const data = encoder.encode(code_verifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const code_challenge = base64UrlEncode(new Uint8Array(hash))

    // 2. Empaquetar el verifier en el STATE (Truco de Arquitecto)
    // En producción, deberías firmar esto con JWT, aquí lo codificamos para el MVP
    const stateObj = { v: code_verifier, r: redirect_uri }
    const state = btoa(JSON.stringify(stateObj))

    // 3. Solicitar el Request URI a Bluesky (PAR - Pushed Authorization Request)
    const parResponse = await fetch("https://bsky.social/oauth/par", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirect_uri,
        response_type: "code",
        scope: "atproto transition:generic",
        state: state,
        code_challenge: code_challenge,
        code_challenge_method: "S256"
      })
    })

    if (!parResponse.ok) {
      const err = await parResponse.text()
      throw new Error(`Error en PAR de Bluesky: ${err}`)
    }

    const parData = await parResponse.json()

    // 4. Construir URL final de autorización
    const auth_url = `https://bsky.social/oauth/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&request_uri=${encodeURIComponent(parData.request_uri)}`

    return new Response(
      JSON.stringify({ auth_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})