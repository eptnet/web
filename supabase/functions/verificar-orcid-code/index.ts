import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Lista de orígenes permitidos para mayor seguridad
const allowedOrigins = [
  'http://127.0.0.1:5500',
  'https://epistecnologia.com'
];

serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[1],
    // **CORRECCIÓN CLAVE**: Se añaden todas las cabeceras necesarias
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Manejo de la petición pre-vuelo (preflight) de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { authorization_code, redirect_uri } = await req.json();
    if (!authorization_code) throw new Error("Falta el código de autorización.");
    if (!redirect_uri) throw new Error("Falta la URI de redirección.");

    const ORCID_CLIENT_ID = Deno.env.get('ORCID_CLIENT_ID');
    const ORCID_CLIENT_SECRET = Deno.env.get('ORCID_CLIENT_SECRET');

    if (!ORCID_CLIENT_ID || !ORCID_CLIENT_SECRET) {
      throw new Error("Las credenciales de ORCID no están configuradas en el servidor.");
    }

    const tokenResponse = await fetch('https://orcid.org/oauth/token', {
      method: 'POST',
      headers: { 
        'Accept': 'application/json', 
        'Content-Type': 'application/x-www-form-urlencoded' 
      },
      body: new URLSearchParams({
        client_id: ORCID_CLIENT_ID,
        client_secret: ORCID_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: authorization_code,
        redirect_uri: redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("Error de ORCID:", errorBody);
      throw new Error("Código de autorización inválido o expirado.");
    }

    const tokenData = await tokenResponse.json();
    const orcidId = tokenData.orcid;

    if (!orcidId) {
      throw new Error("No se pudo obtener el ORCID iD del token.");
    }
    
    return new Response(JSON.stringify({ orcid: orcidId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('Error en la Edge Function:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})