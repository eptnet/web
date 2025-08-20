// supabase/functions/image-proxy/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const imageUrl = url.searchParams.get('url') // Obtenemos la URL de la imagen del parámetro

  if (!imageUrl) {
    return new Response(JSON.stringify({ error: 'Falta el parámetro URL de la imagen.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }

  try {
    // Hacemos la petición para obtener la imagen desde el servidor externo
    const imageResponse = await fetch(imageUrl)

    if (!imageResponse.ok) {
      throw new Error(`No se pudo obtener la imagen. Estado: ${imageResponse.status}`)
    }

    // Clonamos las cabeceras originales de la imagen (como el Content-Type)
    const headers = new Headers(imageResponse.headers)
    
    // Añadimos nuestras cabeceras CORS y la cabecera de política de recursos
    Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value))
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin') // ¡La cabecera mágica!

    // Devolvemos el cuerpo de la imagen (los datos binarios) con las nuevas cabeceras
    return new Response(imageResponse.body, { headers, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})