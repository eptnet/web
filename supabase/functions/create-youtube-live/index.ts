import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts' // Asegúrate de tener este archivo o pon los headers directo

serve(async (req) => {
    // 1. Manejar el CORS para llamadas desde el navegador
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

    try {
        const { title, description } = await req.json();
        if (!title) throw new Error("Se requiere un título para el evento.");

        // 2. Obtener variables de entorno
        const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
        const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
        const refreshToken = Deno.env.get('YOUTUBE_REFRESH_TOKEN');

        if (!clientId || !clientSecret || !refreshToken) {
            throw new Error("Faltan variables de entorno de YouTube.");
        }

        // 3. Generar un Access Token fresco (Dura 1 hora, se renueva en cada petición)
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        if (!accessToken) throw new Error("No se pudo obtener el Access Token de YouTube.");

        const ytHeaders = { 
            Authorization: `Bearer ${accessToken}`, 
            'Content-Type': 'application/json' 
        };

        // 4. Crear el Broadcast (El Evento / Video)
        const broadcastRes = await fetch('https://youtube.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails', {
            method: 'POST',
            headers: ytHeaders,
            body: JSON.stringify({
                snippet: { 
                    title: `🔴 ${title}`, 
                    description: description || "Transmitido en vivo por Epistecnología.",
                    scheduledStartTime: new Date().toISOString() 
                },
                status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
                contentDetails: { 
                    enableAutoStart: true, // ¡Inicia solo cuando OBS manda señal!
                    enableAutoStop: false,
                    monitorStream: { enableMonitorStream: false } // Baja latencia
                }
            })
        });
        const broadcastData = await broadcastRes.json();
        if (broadcastData.error) throw new Error(`YouTube API Error (Broadcast): ${broadcastData.error.message}`);
        const broadcastId = broadcastData.id; // ¡ESTE ES EL ID DEL VIDEO!

        // 5. Crear el Stream (El Contenedor de video que genera la clave)
        const streamRes = await fetch('https://youtube.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn', {
            method: 'POST',
            headers: ytHeaders,
            body: JSON.stringify({
                snippet: { title: `Stream for: ${title}` },
                cdn: { 
                    frameRate: "variable", 
                    ingestionType: "rtmp", 
                    resolution: "variable" 
                }
            })
        });
        const streamData = await streamRes.json();
        if (streamData.error) throw new Error(`YouTube API Error (Stream): ${streamData.error.message}`);
        const streamId = streamData.id;
        const streamKey = streamData.cdn.ingestionInfo.streamName;
        const streamUrl = streamData.cdn.ingestionInfo.ingestionAddress;

        // 6. Unir el Evento con la Clave de Transmisión (Bind)
        const bindRes = await fetch(`https://youtube.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcastId}&streamId=${streamId}&part=id,contentDetails`, {
            method: 'POST',
            headers: ytHeaders
        });
        const bindData = await bindRes.json();
        if (bindData.error) throw new Error(`YouTube API Error (Bind): ${bindData.error.message}`);

        // 7. Retornar los datos mágicos a tu plataforma
        return new Response(JSON.stringify({ 
            success: true, 
            videoId: broadcastId, 
            streamKey: streamKey, 
            streamUrl: streamUrl 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
});