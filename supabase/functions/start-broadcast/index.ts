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

    // Recibimos la llave que el frontend nos mandó
    const reqBody = await req.json().catch(() => ({}));
    const streamKey = reqBody.streamKey;

    const { data: bskyCreds, error: credsError } = await supabase
      .from('bsky_credentials')
      .select('did, access_jwt')
      .eq('user_id', user.id)
      .single()

    if (credsError || !bskyCreds) throw new Error('No hay credenciales de Bluesky.')

    if (!streamKey) throw new Error('Falta el Stream Key.');

    const channelDid = bskyCreds.did;
    const userJwt = bskyCreds.access_jwt;

// ¡ARMAMOS LA URL PERFECTA (Estándar WHIP)!
    // La llave NO va en la ruta. El servidor la leerá del Header 'Bearer' que envía tu frontend.
    const ingestUrl = `https://stream.place/api/whip`; 
    
    // NOTA: Si Streamplace rechaza esta, su servidor base es Livepeer, así que la ruta de contingencia pura sería:
    // const ingestUrl = `https://livepeer.studio/webrtc`;
    const playbackUrl = `https://stream.place/hls/${channelDid}/index.m3u8`;

    await supabase.from('active_broadcasts').update({ status: 'ended' }).eq('user_id', user.id).eq('status', 'live');

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

    return new Response(JSON.stringify({ 
      success: true, 
      ingestUrl: ingestUrl,
      playbackUrl: playbackUrl,
      broadcast_id: broadcastData.id,
      streamToken: userJwt
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