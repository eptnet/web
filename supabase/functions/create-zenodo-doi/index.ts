// En: supabase/functions/create-zenodo-doi/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado.");

    const { filePath, metadata } = await req.json();
    if (!filePath || !metadata) throw new Error("Faltan datos esenciales.");
    const ZENODO_API_TOKEN = Deno.env.get('ZENODO_API_TOKEN');
    if (!ZENODO_API_TOKEN) throw new Error("El token de API de Zenodo no está configurado.");

    // 1. Crear borrador en Zenodo
    const depositionResponse = await fetch('https://zenodo.org/api/deposit/depositions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZENODO_API_TOKEN}` },
      body: JSON.stringify({})
    });
    if (!depositionResponse.ok) throw new Error("No se pudo crear la deposición en Zenodo.");
    const depositionData = await depositionResponse.json();
    const { id: depositionId, links: { bucket: bucketUrl } } = depositionData;

    // 2. Descargar archivo de Supabase Storage
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from('zenodo-uploads').download(filePath);
    if (downloadError) throw downloadError;
    
    // --- 3. Subir archivo a Zenodo (SECCIÓN CORREGIDA) ---
    const fileName = filePath.split('/').pop();
    const uploadResponse = await fetch(`${bucketUrl}/${fileName}`, {
      method: 'PUT',
      // CORRECCIÓN: Zenodo requiere el token también para la subida del archivo.
      headers: { 
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${ZENODO_API_TOKEN}`
      },
      body: fileData
    });
    // Verificamos que la subida del archivo fue exitosa
    if(!uploadResponse.ok) throw new Error("La subida del archivo a Zenodo falló.");
    
    // --- 4. Añadir metadatos a Zenodo ---
    const metadataPayload = {
      metadata: {
        title: metadata.title,
        upload_type: 'publication',
        publication_type: 'other',
        description: metadata.description,
        creators: metadata.authors.map(author => ({
            name: author,
            affiliation: metadata.affiliations || ''
        })),
        keywords: metadata.keywords || [],
        access_right: 'open',
        license: metadata.license || 'cc-by-4.0',
        communities: [{ identifier: 'epistecnologia' }],
        related_identifiers: [] // Siempre incluimos el array
      }
    };

    // Si el usuario proporcionó un enlace, lo añadimos al array en el formato que Zenodo espera
    if (metadata.relatedLink) {
        metadataPayload.metadata.related_identifiers.push({
            scheme: 'url',
            identifier: metadata.relatedLink,
            relation: 'references', // Relación estándar: "hace referencia a"
        });
    }
    await fetch(`https://zenodo.org/api/deposit/depositions/${depositionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZENODO_API_TOKEN}` },
      body: JSON.stringify(metadataPayload)
    });

    // 5. Publicar para obtener el DOI
    const publishResponse = await fetch(`https://zenodo.org/api/deposit/depositions/${depositionId}/actions/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ZENODO_API_TOKEN}` }
    });
    if (!publishResponse.ok) {
        const errorBody = await publishResponse.json();
        console.error("Error al publicar en Zenodo:", errorBody);
        throw new Error("No se pudo publicar la deposición. Revisa los metadatos.");
    }
    const publishedData = await publishResponse.json();
    const newDoi = publishedData.doi;

    // 6. Guardar en nuestra tabla 'projects'
    await supabaseClient.from('projects').insert({
      user_id: user.id,
      doi: newDoi,
      title: metadata.title,
      authors: metadata.authors,
      description: metadata.description,
      publication_year: new Date().getFullYear(),
      created_via_platform: true
    });
    
    // 7. Limpiar archivo temporal de Storage
    await supabaseAdmin.storage.from('zenodo-uploads').remove([filePath]);

    return new Response(JSON.stringify({ doi: newDoi }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('Error en la Edge Function create-zenodo-doi:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});