import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo del preflight de CORS (Obligatorio)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Falta el token de autorización en la cabecera.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 2. Verificar usuario autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('No estás autenticado en la plataforma.')

    // 3. Extraer el Body de forma segura
    let reqBody = {};
    try { reqBody = await req.json(); } catch (e) { /* Si no hay body, sigue siendo {} */ }
    
    const streamKey = reqBody.streamKey;
    if (!streamKey) throw new Error('Falta el Stream Key en el cuerpo de la petición.');

    // 4. Buscar Credenciales
    const { data: bskyCreds, error: credsError } = await supabase
      .from('bsky_credentials')
      .select('did, access_jwt')
      .eq('user_id', user.id)
      .single()

    if (credsError || !bskyCreds) throw new Error('No se encontraron credenciales de Bluesky en la base de datos.')

    const channelDid = bskyCreds.did;

    // 5. Armar las URLs (¡Estándar WHIP!)
    // ¡ARMAMOS LA URL PERFECTA (Codificada para soportar DIDs)!
    const ingestUrl = `https://stream.place/api/ingest/webrtc/${encodeURIComponent(streamKey)}`;
    const playbackUrl = `https://stream.place/hls/${channelDid}/index.m3u8`;

    // 6. Limpiar directos "fantasma" previos
    await supabase.from('active_broadcasts').update({ status: 'ended' }).eq('user_id', user.id).eq('status', 'live');

    // 7. Insertar el nuevo directo en la BD
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

    if (dbError) throw new Error(`Error en Base de Datos: ${dbError.message}`);

    // 8. ÉXITO: Retornar los datos en JSON
    return new Response(JSON.stringify({ 
      success: true, 
      ingestUrl: ingestUrl,
      playbackUrl: playbackUrl,
      broadcast_id: broadcastData.id
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    // 🛡️ EL ESCUDO: Si cualquier cosa falla arriba, devolvemos el error EN FORMATO JSON
    console.error("Error capturado en Edge Function:", error.message);
    return new Response(
        JSON.stringify({ error: error.message }), 
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})