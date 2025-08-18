// VERSIÓN FINAL Y CORREGIDA para supabase/functions/zoom-signature/index.ts

import { create } from 'https://deno.land/x/djwt@v2.7/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const ZOOM_SDK_KEY = Deno.env.get('ZOOM_SDK_KEY');
const ZOOM_SDK_SECRET = Deno.env.get('ZOOM_SDK_SECRET');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionName, role } = await req.json();

    if (!sessionName || role === undefined) {
      throw new Error('sessionName y role son requeridos.');
    }
    
    // --- INICIO DE LA CORRECCIÓN ---
    // La librería 'djwt' requiere que la clave secreta sea un objeto CryptoKey, no un string.
    // Convertimos el SDK Secret de string a un formato que el algoritmo HMAC pueda usar.
    const key = await crypto.subtle.importKey(
      "raw", // El formato de nuestra clave es texto plano (raw)
      new TextEncoder().encode(ZOOM_SDK_SECRET), // Convertimos el string a un buffer de bytes
      { name: "HMAC", hash: "SHA-256" }, // El algoritmo que usaremos
      false, // La clave no será extraíble
      ["sign", "verify"] // El propósito de la clave es firmar y verificar
    );
    // --- FIN DE LA CORRECCIÓN ---

    const roleType = role === 'host' ? 1 : 0;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2; 

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
      key // Usamos la clave ya convertida en lugar del string
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