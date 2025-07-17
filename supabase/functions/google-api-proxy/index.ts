// /supabase/functions/google-api-proxy/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3/'

serve(async (req) => {
  // Manejo de la petición CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type'
    }})
  }

  try {
    // 1. Obtenemos los parámetros de la petición (ej. qué video buscar)
    const { endpoint, params } = await req.json()
    if (!endpoint || !params) {
      throw new Error("Petición incompleta: se requiere 'endpoint' y 'params'.")
    }

    // 2. Obtenemos la clave secreta de Google desde los secretos de Supabase
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!googleApiKey) {
      throw new Error("La clave de API de Google no está configurada como secreto.")
    }

    // 3. Construimos la URL final para la API de YouTube
    const queryParams = new URLSearchParams({
      ...params,
      key: googleApiKey, // Añadimos la clave secreta a la petición
    }).toString()

    const requestUrl = `${YOUTUBE_API_BASE_URL}${endpoint}?${queryParams}`

    // 4. Hacemos la llamada a la API de YouTube desde el servidor
    const youtubeResponse = await fetch(requestUrl)
    if (!youtubeResponse.ok) {
      const errorData = await youtubeResponse.json();
      throw new Error(`Error de la API de YouTube: ${errorData.error.message}`)
    }

    const data = await youtubeResponse.json()

    // 5. Devolvemos la respuesta de YouTube al navegador
    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        },
        status: 200 
      }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        status: 400 
      }
    )
  }
})