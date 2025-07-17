// /supabase/functions/get-orcid-works/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }})
  }
  try {
    const { orcid_id } = await req.json();
    if (!orcid_id) throw new Error("Falta el ORCID iD.");

    // Hacemos la llamada a la API pública de ORCID
    const response = await fetch(`https://pub.orcid.org/v3.0/${orcid_id}/works`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) throw new Error("No se pudieron obtener los trabajos de ORCID.");

    const data = await response.json();

    // Procesamos la respuesta para extraer solo lo que necesitamos (título y DOI)
    const works = data.group.map(workGroup => {
      const summary = workGroup['work-summary'][0];
      const title = summary.title.title.value;
      let doi = null;
      const externalIds = summary['external-ids']['external-id'];
      if (externalIds) {
        const doiObject = externalIds.find(id => id['external-id-type'] === 'doi');
        if (doiObject) {
          doi = doiObject['external-id-value'];
        }
      }
      return { title, doi };
    }).filter(work => work.doi); // Filtramos para quedarnos solo con los que tienen DOI

    return new Response(JSON.stringify({ works }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 400 }
    );
  }
})