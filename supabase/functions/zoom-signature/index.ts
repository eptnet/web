// supabase/functions/zoom-signature/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { create } from "https://deno.land/x/djwt@v2.9.1/mod.ts";
import { corsHeaders } from '../_shared/cors.ts'

async function prepareSecretKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- INICIO DE LA CORRECCIÓN ---
    // Le decimos al servidor que espere 'role_type' en lugar de 'role'
    const { sessionName, role_type } = await req.json()

    // Actualizamos la validación para que compruebe 'role_type'
    if (!sessionName || role_type === undefined) {
      throw new Error('sessionName y role_type son requeridos.')
    }
    // --- FIN DE LA CORRECCIÓN ---

    const sdkKey = Deno.env.get('ZOOM_SDK_KEY')
    const sdkSecret = Deno.env.get('ZOOM_SDK_SECRET')

    if (!sdkKey || !sdkSecret) {
      throw new Error('Las credenciales del SDK de Zoom no están configuradas.')
    }

    const preparedKey = await prepareSecretKey(sdkSecret);

    const signature = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        app_key: sdkKey,
        sdkKey: sdkKey,
        tpc: sessionName,
        role_type: role_type, // Pasamos el valor correcto
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7200,
        tokenExp: Math.floor(Date.now() / 1000) + 7200,
      },
      preparedKey
    )

    return new Response(
      JSON.stringify({ signature: signature }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error generando la firma:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})