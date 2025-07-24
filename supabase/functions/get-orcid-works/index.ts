// /supabase/functions/get-orcid-works/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const ORCID_API_URL = 'https://pub.orcid.org/v3.0';
const allowedOrigins = [ 'http://127.0.0.1:5500', 'https://epistecnologia.com' ];

serve(async (req) => {
  // Manejo de CORS
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[1],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orcid_id } = await req.json();
    if (!orcid_id) throw new Error("Falta el ORCID iD.");

    // 1. Obtenemos la lista de trabajos (resúmenes)
    const summaryResponse = await fetch(`${ORCID_API_URL}/${orcid_id}/works`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!summaryResponse.ok) throw new Error("No se pudo obtener la lista de trabajos de ORCID.");
    
    const summaryData = await summaryResponse.json();
    if (!summaryData?.group) return new Response(JSON.stringify({ works: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 2. Creamos una lista de promesas para obtener los detalles de CADA trabajo
    const detailPromises = summaryData.group.map(workGroup => {
      const path = workGroup['work-summary'][0]?.path;
      if (!path) return null;
      return fetch(`${ORCID_API_URL}${path}`, { headers: { 'Accept': 'application/json' } });
    }).filter(Boolean);

    const detailResponses = await Promise.all(detailPromises);

    // 3. Procesamos los detalles completos de cada trabajo
    const works = [];
    for (const res of detailResponses) {
      if (res.ok) {
        const detail = await res.json();
        const doi = detail['external-ids']?.['external-id']?.find(id => id['external-id-type'] === 'doi')?.['external-id-value'] || null;
        
        if (doi) { // Solo procesamos trabajos que tengan DOI
          const title = detail.title?.title?.value || 'Título no disponible';
          const year = detail['publication-date']?.year?.value || null;
          const description = detail['short-description'] || null; // El resumen/abstract
          let authors = [];
          const contributors = detail.contributors?.contributor;
          if (Array.isArray(contributors)) {
            authors = contributors.map(c => c['credit-name']?.value).filter(Boolean);
          }
          works.push({ title, year, doi, authors, description });
        }
      }
    }

    return new Response(JSON.stringify({ works }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error("Error en Edge Function get-orcid-works:", err);
    return new Response(JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})