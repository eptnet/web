import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS para el navegador
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Validar sesión del investigador
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // 2. Llamada a la API de Streamplace (Simulación de creación de sala)
    // NOTA: Aquí insertarás el endpoint exacto de Streamplace cuando tengas tu API Key.
    // Streamplace usa WHIP (WebRTC HTTP Ingestion Protocol) para recibir video.
    
    // Configuración Base de Streamplace (Añadir a Supabase Secrets después)
    const spApiUrl = Deno.env.get('STREAMPLACE_API_URL') || 'https://stream.place/api/v1/streams';
    // const spApiKey = Deno.env.get('STREAMPLACE_API_KEY'); 
    
    // --- CONEXIÓN REAL A STREAMPLACE (WHIP NATIVO) ---
    const streamKey = Deno.env.get('STREAMPLACE_STREAM_KEY');
    if (!streamKey) throw new Error('Stream Key no configurada en Supabase');

    // 1. Obtener el DID (Identificador Descentralizado) del usuario para la URL de reproducción
    const { data: bskyCreds, error: credsError } = await supabase
      .from('bsky_credentials')
      .select('did, handle')
      .eq('user_id', user.id)
      .single();

    const channelDid = bskyCreds?.did || 'did:plc:default'; // El reproductor buscará la señal aquí

    // 2. URL WHIP de Streamplace: El estándar permite inyectar la llave en la ruta de ingestión
    const ingestUrl = `https://stream.place/api/ingest/webrtc/${streamKey}`; 
    
    // 3. URL de Reproducción HLS (Esta ruta puede ajustarse luego según el enrutamiento exacto de stream.place)
    const playbackUrl = `https://stream.place/hls/${channelDid}/index.m3u8`; 
    
    const streamId = `live_${user.id.substring(0, 8)}`; // ID interno para Supabase

    // 3. Registrar el "EN VIVO" en Supabase para que el Realtime avise a la comunidad
    const { error: dbError } = await supabase
      .from('active_broadcasts')
      .insert({
        user_id: user.id,
        streamplace_id: streamId,
        playback_url: playbackUrl,
        status: 'live'
      })

    if (dbError) throw dbError;

    // 4. Devolver las credenciales de ingesta al navegador
    return new Response(JSON.stringify({ 
      success: true, 
      ingestUrl: ingestUrl 
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en start-broadcast:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})