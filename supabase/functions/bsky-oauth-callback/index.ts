import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64UrlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: Forja el escudo criptográfico DPoP
async function generateDpopProof(htu: string, htm: string, keyPair: CryptoKeyPair, publicJwk: any, nonce?: string) {
  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y }
  }

  const payload: any = {
    jti: crypto.randomUUID(),
    htm: htm,
    htu: htu,
    iat: Math.floor(Date.now() / 1000)
  }
  
  if (nonce) payload.nonce = nonce

  const encoder = new TextEncoder()
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const dataToSign = encoder.encode(`${headerB64}.${payloadB64}`)

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    keyPair.privateKey,
    dataToSign
  )

  const signatureB64 = base64UrlEncode(new Uint8Array(signature))
  return `${headerB64}.${payloadB64}.${signatureB64}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { code, state, redirect_uri } = await req.json()
    const CLIENT_ID = "https://epistecnologia.com/oauth-client-metadata.json"

    // 1. Extraer el Verifier oculto
    const decodedState = JSON.parse(atob(state))
    const code_verifier = decodedState.v

    // 2. Autenticar Supabase
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error("Usuario no autenticado en Supabase.")

    // 3. Generar la Llave Criptográfica DPoP
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    )
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey)
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey)

    const tokenUrl = "https://bsky.social/oauth/token"
    let dpopProof = await generateDpopProof(tokenUrl, "POST", keyPair, publicJwk)
    
    const bodyParams = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      redirect_uri: redirect_uri,
      code: code,
      code_verifier: code_verifier
    })

    // 4. Primera petición a Bluesky
    let tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "DPoP": dpopProof },
      body: bodyParams
    })

    // 5. Manejo de Anti-Replay (Si Bluesky pide un Nonce por seguridad extra)
    if (tokenResponse.status === 400) {
      const errText = await tokenResponse.text()
      const dpopNonce = tokenResponse.headers.get("DPoP-Nonce") || tokenResponse.headers.get("dpop-nonce")
      
      if (errText.includes("use_dpop_nonce") && dpopNonce) {
        dpopProof = await generateDpopProof(tokenUrl, "POST", keyPair, publicJwk, dpopNonce)
        tokenResponse = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "DPoP": dpopProof },
          body: bodyParams
        })
      } else {
        throw new Error(`Error en Bluesky: ${errText}`)
      }
    }

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      throw new Error(`Error definitivo canjeando token: ${err}`)
    }

    const tokens = await tokenResponse.json()
    const did = tokens.sub

    // 6. Obtener el Handle del investigador
    const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`)
    let handle = did
    if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      handle = profileData.handle
    }

    // 7. Guardado Seguro: Empaquetamos la llave privada en el JWT para no crear columnas nuevas
    const secureRefreshData = JSON.stringify({ 
        token: tokens.refresh_token, 
        jwk: privateJwk 
    })

    const { error: dbError } = await supabase
      .from('bsky_credentials')
      .upsert({ 
        user_id: user.id, 
        handle: handle, 
        did: did,
        access_jwt: tokens.access_token, 
        refresh_jwt: secureRefreshData,
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