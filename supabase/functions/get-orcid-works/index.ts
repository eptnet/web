// /supabase/functions/get-orcid-works/index.ts - VERSIÓN CORREGIDA

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2' // Asegúrate de que esta línea esté si no la tenías

serve(async (req) => {
  // --- INICIO DE LA CORRECCIÓN ---
  // Manejo de la petición pre-vuelo CORS, ahora con todas las cabeceras necesarias
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*', // O tu dominio para más seguridad
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
      }
    })
  }
  // --- FIN DE LA CORRECCIÓN ---

  try {
    const ORCID_CLIENT_ID = Deno.env.get('ORCID_CLIENT_ID');
    const ORCID_CLIENT_SECRET = Deno.env.get('ORCID_CLIENT_SECRET');

    if (!ORCID_CLIENT_ID || !ORCID_CLIENT_SECRET) {
      throw new Error("Las credenciales de cliente de ORCID no están configuradas.");
    }
    
    const { orcid_id } = await req.json();
    if (!orcid_id) throw new Error("Falta el ORCID iD.");

    const tokenResponse = await fetch('https://orcid.org/oauth/token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ORCID_CLIENT_ID,
        client_secret: ORCID_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: '/read-public',
      }),
    });

    if (!tokenResponse.ok) throw new Error("No se pudo obtener el token de acceso de ORCID.");
    const { access_token } = await tokenResponse.json();

    const worksResponse = await fetch(`https://pub.orcid.org/v3.0/${orcid_id}/works`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${access_token}` },
    });
    
    if (!worksResponse.ok) throw new Error("No se pudieron obtener los trabajos de ORCID.");
    const data = await worksResponse.json();
    
    const works = data.group.map(workGroup => {
      const summary = workGroup['work-summary'][0];
      const title = summary.title.title.value;
      let doi = null;
      const externalIds = summary['external-ids']['external-id'];
      if (externalIds) {
        const doiObject = externalIds.find(id => id['external-id-type'] === 'doi');
        if (doiObject) { doi = doiObject['external-id-value']; }
      }
      return { title, doi };
    }).filter(work => work.doi);

    return new Response(JSON.stringify({ works }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 400 }
    );
  }
})