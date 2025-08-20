// supabase/functions/zoom-signature/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { create } from "https://deno.land/x/djwt@v2.9.1/mod.ts";
import { corsHeaders } from '../_shared/cors.ts'

// --- INICIO DE LA CORRECCIÓN ---
// Función para preparar la clave secreta al formato correcto (CryptoKey)
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
// --- FIN DE LA CORRECCIÓN ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionName, role } = await req.json()

    if (!sessionName || role === undefined) {
      throw new Error('sessionName y role son requeridos.')
    }

    const sdkKey = Deno.env.get('ZOOM_SDK_KEY')
    const sdkSecret = Deno.env.get('ZOOM_SDK_SECRET')

    if (!sdkKey || !sdkSecret) {
      throw new Error('Las credenciales del SDK de Zoom no están configuradas en las variables de entorno.')
    }

    // --- APLICACIÓN DE LA CORRECCIÓN ---
    // 1. Preparamos la clave secreta antes de usarla
    const preparedKey = await prepareSecretKey(sdkSecret);

    // 2. Usamos la clave ya formateada para crear la firma
    const signature = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        app_key: sdkKey,
        sdkKey: sdkKey,
        mn: sessionName,
        role: role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7200,
        tokenExp: Math.floor(Date.now() / 1000) + 7200,
      },
      preparedKey // Se pasa la clave en el formato correcto
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