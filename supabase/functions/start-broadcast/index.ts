import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 0. Manejo de CORS (Seguridad del navegador)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Validar la sesión del investigador en Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('No estás autenticado en Epistecnología.')

    // 2. Extraer Identidad Descentralizada (DID) y Tokens
    const { data: bskyCreds, error: credsError } = await supabase
      .from('bsky_credentials')
      .select('did, access_jwt')
      .eq('user_id', user.id)
      .single()

    if (credsError || !bskyCreds) {
      throw new Error('No se encontraron credenciales del Protocolo AT. Por favor, conecta tu cuenta de Bluesky.')
    }

    const channelDid = bskyCreds.did;
    const userJwt = bskyCreds.access_jwt;

    // 3. Negociación con Streamplace (API / Lexicon)
    // Aquí hacemos la petición autorizada para pedir las URLs dinámicas.
    const spApiUrl = Deno.env.get('STREAMPLACE_API_URL') || 'https://stream.place/api/v1/streams';
    
    let ingestUrl = `https://stream.place/whip/${channelDid}`;
    let playbackUrl = `https://stream.place/hls/${channelDid}/index.m3u8`;

    try {
      // Intentamos registrar/despertar el stream en Streamplace usando el token del usuario
      const spResponse = await fetch(spApiUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userJwt}` // Pasaporte Web3
          },
          body: JSON.stringify({ did: channelDid })
      });

      // Si Streamplace responde con URLs específicas, las usamos. 
      // Si no (por ej. si usan rutas determinísticas basadas en DID), usamos el fallback de arriba.
      if (spResponse.ok) {
          const spData = await spResponse.json();
          if (spData.ingestUrl) ingestUrl = spData.ingestUrl;
          if (spData.playbackUrl) playbackUrl = spData.playbackUrl;
      } else {
          console.warn(`Streamplace API devolvió ${spResponse.status}. Usando URLs determinísticas basadas en DID.`);
      }
    } catch (apiError) {
      console.warn("Fallo en la comunicación inicial con Streamplace, procediendo con rutas WHIP estándar:", apiError);
    }

    // 4. Mantenimiento de BD: Limpiar streams viejos que quedaron "fantasma"
    await supabase
        .from('active_broadcasts')
        .update({ status: 'ended' })
        .eq('user_id', user.id)
        .eq('status', 'live');

    // 5. Registrar el "EN VIVO" oficial en la Comunidad
    const { data: broadcastData, error: dbError } = await supabase
      .from('active_broadcasts')
      .insert({
        user_id: user.id,
        streamplace_id: channelDid, // Usamos el DID como ID unificado para Streamplace
        playback_url: playbackUrl,
        status: 'live'
      })
      .select('id') // PEDIMOS QUE NOS DEVUELVA EL ID EXACTO
      .single()

    if (dbError) throw dbError;

    // 6. Retornar las llaves de ignición al Frontend (comunidad.js)
    return new Response(JSON.stringify({ 
      success: true, 
      ingestUrl: ingestUrl,
      playbackUrl: playbackUrl,
      broadcast_id: broadcastData.id, // ¡CRÍTICO PARA EL CHAT EFÍMERO!
      streamToken: userJwt
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Error en streamplace-init:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})