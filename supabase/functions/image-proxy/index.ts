// supabase/functions/image-proxy/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// Eliminamos la importación de corsHeaders porque vamos a definirlos aquí para mayor claridad
// import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const imageUrl = url.searchParams.get('url')

  // --- INICIO DE LA CORRECCIÓN ---
  // Definimos las cabeceras CORS aquí para asegurar que siempre se incluyan
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Permite que cualquier dominio acceda
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  // --- FIN DE LA CORRECCIÓN ---

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!imageUrl) {
    return new Response(JSON.stringify({ error: 'Falta el parámetro URL de la imagen.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }

  try {
    const imageResponse = await fetch(imageUrl)

    if (!imageResponse.ok) {
      throw new Error(`No se pudo obtener la imagen. Estado: ${imageResponse.status}`)
    }

    const headers = new Headers(imageResponse.headers)
    
    Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value))
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin') 

    return new Response(imageResponse.body, { headers, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})