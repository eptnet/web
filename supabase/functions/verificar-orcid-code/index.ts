import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }})
  }

  try {
    const { authorization_code, redirect_uri } = await req.json();
    if (!authorization_code) throw new Error("Falta el código de autorización.");

    const ORCID_CLIENT_ID = Deno.env.get('ORCID_CLIENT_ID');
    const ORCID_CLIENT_SECRET = Deno.env.get('ORCID_CLIENT_SECRET');

    // Intercambiamos el código por un token de acceso y el ORCID iD
    const tokenResponse = await fetch('https://orcid.org/oauth/token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ORCID_CLIENT_ID,
        client_secret: ORCID_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: authorization_code,
        redirect_uri: redirect_uri,
      }),
    });

    if (!tokenResponse.ok) throw new Error("Código de autorización inválido o expirado.");

    const tokenData = await tokenResponse.json();
    const orcidId = tokenData.orcid; // El iD del usuario autenticado

    if (!orcidId) throw new Error("No se pudo obtener el ORCID iD del token.");

    // Devolvemos el ORCID iD verificado al cliente
    return new Response(JSON.stringify({ orcid: orcidId }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 200 }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 400 }
    );
  }
})