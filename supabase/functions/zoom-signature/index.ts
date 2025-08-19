import { create } from 'https://deno.land/x/djwt@v2.7/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Cabeceras CORS para permitir peticiones desde cualquier origen
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Obtenemos las credenciales de los secrets de Supabase
const ZOOM_SDK_KEY = Deno.env.get('ZOOM_SDK_KEY');
const ZOOM_SDK_SECRET = Deno.env.get('ZOOM_SDK_SECRET');

serve(async (req) => {
  // Manejo de la petición OPTIONS (pre-vuelo de CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionName, role } = await req.json();

    if (!sessionName || role === undefined) {
      throw new Error('sessionName y role son requeridos.');
    }
    
    // Convertimos el SDK Secret al formato CryptoKey que la librería espera
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(ZOOM_SDK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const roleType = role === 'host' ? 1 : 0;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2; // Válido por 2 horas

    const payload = {
      app_key: ZOOM_SDK_KEY,
      sdkKey: ZOOM_SDK_KEY,
      mn: sessionName,
      role: roleType,
      iat: iat,
      exp: exp,
      tokenExp: exp,
    };

    const signature = await create(
      { alg: 'HS256', typ: 'JWT' },
      payload,
      key
    );

    return new Response(
      JSON.stringify({ signature }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Error en la función: ${err.message}` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});