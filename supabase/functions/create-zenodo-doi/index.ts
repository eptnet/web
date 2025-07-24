// /supabase/functions/create-zenodo-doi/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Define los orígenes permitidos para las llamadas (tu sitio local y el de producción)
const allowedOrigins = [
  'http://127.0.0.1:5500',
  'https://epistecnologia.com'
];

serve(async (req) => {
  // --- Manejo de CORS (Más Seguro) ---
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[1],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Autenticación y Validación ---
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado.");

    const { filePath, metadata } = await req.json();
    if (!filePath || !metadata) throw new Error("Faltan datos esenciales (ruta del archivo o metadatos).");
    
    const ZENODO_API_TOKEN = Deno.env.get('ZENODO_API_TOKEN');
    if (!ZENODO_API_TOKEN) throw new Error("El token de API de Zenodo no está configurado en el servidor.");

    // --- Paso 1: Obtener perfil del autor ---
    const { data: profile } = await supabaseClient.from('profiles').select('display_name').eq('id', user.id).single();
    if (!profile) throw new Error("No se pudo encontrar el perfil del usuario.");
    
    // --- Paso 2: Crear borrador (deposición) en Zenodo ---
    console.log("Paso 2: Creando deposición en Zenodo...");
    const depositionResponse = await fetch('https://zenodo.org/api/deposit/depositions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZENODO_API_TOKEN}` },
      body: JSON.stringify({})
    });
    if (!depositionResponse.ok) throw new Error("No se pudo crear la deposición en Zenodo.");
    const depositionData = await depositionResponse.json();
    const depositionId = depositionData.id;
    const bucketUrl = depositionData.links.bucket;

    // --- Paso 3: Descargar archivo de Supabase Storage ---
    console.log("Paso 3: Descargando archivo desde Supabase Storage...");
    const { data: fileData, error: downloadError } = await supabaseClient.storage.from('avatars').download(filePath);
    if (downloadError) throw downloadError;
    
    // --- Paso 4: Subir archivo a Zenodo ---
    console.log("Paso 4: Subiendo archivo a Zenodo...");
    const fileName = filePath.split('/').pop();
    await fetch(`${bucketUrl}/${fileName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'Authorization': `Bearer ${ZENODO_API_TOKEN}` },
      body: fileData
    });
    
    // --- Paso 5: Añadir metadatos a Zenodo ---
    console.log("Paso 5: Añadiendo metadatos a Zenodo...");
    const metadataPayload = {
      metadata: {
        title: metadata.title,
        upload_type: 'other',
        description: metadata.description,
        creators: [{ name: profile.display_name }],
        communities: [{ identifier: 'epistecnologia' }]
      }
    };
    await fetch(`https://zenodo.org/api/deposit/depositions/${depositionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZENODO_API_TOKEN}` },
      body: JSON.stringify(metadataPayload)
    });

    // --- Paso 6: Publicar en Zenodo para obtener el DOI ---
    console.log("Paso 6: Publicando para obtener DOI...");
    const publishResponse = await fetch(`https://zenodo.org/api/deposit/depositions/${depositionId}/actions/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ZENODO_API_TOKEN}` }
    });
    if (!publishResponse.ok) throw new Error("No se pudo publicar la deposición en Zenodo.");
    const publishedData = await publishResponse.json();
    const newDoi = publishedData.doi;

   // --- Paso 7: Guardamos el nuevo proyecto en nuestra base de datos ---
    await supabaseClient.from('projects').insert({
      user_id: user.id,
      doi: newDoi,
      title: metadata.title,
      authors: [profile.display_name],
      created_via_platform: true // <-- LÍNEA AÑADIDA
    });
    
    // --- Paso 8: Borrar archivo temporal ---
    console.log("Paso 8: Limpiando archivo temporal...");
    await supabaseClient.storage.from('avatars').remove([filePath]);

    // --- Éxito ---
    return new Response(JSON.stringify({ doi: newDoi }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('Error en la Edge Function:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});