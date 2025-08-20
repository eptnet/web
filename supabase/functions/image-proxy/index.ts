// supabase/functions/image-proxy/index.ts - VERSIÓN FINAL Y CORRECTA

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Define las cabeceras CORS que se usarán en todas las respuestas
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Responde inmediatamente a las peticiones "pre-vuelo" de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
      return new Response('Falta el parámetro URL de la imagen.', { status: 400, headers: corsHeaders });
    }

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return new Response(`No se pudo obtener la imagen. Estado: ${imageResponse.status}`, { status: imageResponse.status, headers: corsHeaders });
    }
    
    // Crea nuevas cabeceras para la respuesta final
    const headers = new Headers(corsHeaders);
    
    // Copia cabeceras importantes de la imagen original, como el tipo de contenido
    if (imageResponse.headers.has('content-type')) {
      headers.set('Content-Type', imageResponse.headers.get('content-type')!);
    }
    if (imageResponse.headers.has('content-length')) {
      headers.set('Content-Length', imageResponse.headers.get('content-length')!);
    }
    
    // Añade la cabecera clave que permite que el recurso se incruste
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    // Devuelve la imagen con todas las cabeceras correctas
    return new Response(imageResponse.body, { headers });

  } catch (error) {
    return new Response(`Error al procesar la imagen: ${error.message}`, { status: 500, headers: corsHeaders });
  }
});