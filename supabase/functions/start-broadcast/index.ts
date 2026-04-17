import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('No estás autenticado.')

    const { data: bskyCreds, error: credsError } = await supabase
      .from('bsky_credentials')
      .select('did, access_jwt')
      .eq('user_id', user.id)
      .single()

    if (credsError || !bskyCreds) throw new Error('No hay credenciales de Bluesky.')

    const channelDid = bskyCreds.did;
    const userJwt = bskyCreds.access_jwt;

    let ingestUrl = "";
    let playbackUrl = `https://stream.place/hls/${channelDid}/index.m3u8`;

    // 1. EL VERDADERO NEGOCIADOR LEXICON
    // Consultamos la ruta oficial de Streamplace para obtener tu URL de Ingesta
    const lexResponse = await fetch('https://stream.place/xrpc/place.stream.ingest.getIngestUrls', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userJwt}`,
        'Content-Type': 'application/json'
      }
    });

    // ¡LA TRAMPA! Si Streamplace nos rechaza, queremos saber exactamente por qué
    if (!lexResponse.ok) {
        const errorText = await lexResponse.text();
        throw new Error(`Lexicon Rechazó la petición (${lexResponse.status}): ${errorText}`);
    }

    const lexData = await lexResponse.json();
    
    // Tratamos de extraer la URL WHIP del array oficial de Streamplace
    if (lexData.ingests && Array.isArray(lexData.ingests)) {
        const whipEndpoint = lexData.ingests.find((i: any) => i.type === 'whip');
        if (whipEndpoint && whipEndpoint.url) {
            ingestUrl = whipEndpoint.url;
            
            // Fix Inteligente: Si Streamplace devuelve solo el dominio root, apuntamos al enrutador WHIP estándar
            if (ingestUrl === "https://stream.place" || ingestUrl === "https://stream.place/") {
                ingestUrl = "https://stream.place/whip";
            }
        }
    } else {
        // Fallback de emergencia si la API cambia su estructura en el futuro
        ingestUrl = `https://stream.place/whip`;
    }

    // 2. Limpieza de base de datos
    await supabase.from('active_broadcasts').update({ status: 'ended' }).eq('user_id', user.id).eq('status', 'live');

    // 3. Registro en la Comunidad
    const { data: broadcastData, error: dbError } = await supabase
      .from('active_broadcasts')
      .insert({
        user_id: user.id,
        streamplace_id: channelDid,
        playback_url: playbackUrl,
        status: 'live'
      })
      .select('id')
      .single()

    if (dbError) throw dbError;

    // 4. Devolvemos el armamento pesado al Frontend
    return new Response(JSON.stringify({ 
      success: true, 
      ingestUrl: ingestUrl,
      playbackUrl: playbackUrl,
      broadcast_id: broadcastData.id,
      streamToken: userJwt,
      lexiconPayload: lexData // <--- NUEVO: Sacamos a la luz los datos secretos
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})