// supabase/functions/image-proxy/index.ts - VERSIÓN DEFINITIVA Y SIMPLIFICADA

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Manejo de la petición OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type, authorization'
      }
    });
  }

  const url = new URL(req.url);
  const imageUrl = url.searchParams.get('url');

  if (!imageUrl) {
    return new Response('Falta el parámetro URL de la imagen.', { status: 400 });
  }

  try {
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return new Response(`No se pudo obtener la imagen. Estado: ${imageResponse.status}`, { status: imageResponse.status });
    }
    
    // Creamos nuevas cabeceras para nuestra respuesta
    const headers = new Headers();
    
    // Copiamos la cabecera 'Content-Type' original (ej. 'image/jpeg')
    if (imageResponse.headers.has('content-type')) {
      headers.set('Content-Type', imageResponse.headers.get('content-type')!);
    }
    
    // Añadimos las dos cabeceras de seguridad requeridas
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    // Devolvemos el cuerpo de la imagen con nuestras cabeceras personalizadas
    return new Response(imageResponse.body, { headers });

  } catch (error) {
    return new Response(`Error al procesar la imagen: ${error.message}`, { status: 500 });
  }
});