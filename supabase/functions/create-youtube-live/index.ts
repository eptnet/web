import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

    try {
        // Añadimos thumbnailUrl para recibir la imagen
        const { title, description, thumbnailUrl } = await req.json();
        if (!title) throw new Error("Se requiere un título para el evento.");

        const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
        const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
        const refreshToken = Deno.env.get('YOUTUBE_REFRESH_TOKEN');

        if (!clientId || !clientSecret || !refreshToken) {
            throw new Error("Faltan variables de entorno de YouTube.");
        }

        // 3. Generar Access Token fresco
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
        if (!accessToken) throw new Error("No se pudo obtener el Access Token.");

        const ytHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

        // 4. Crear el Broadcast
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
                contentDetails: { enableAutoStart: true, enableAutoStop: false, monitorStream: { enableMonitorStream: false } }
            })
        });
        const broadcastData = await broadcastRes.json();
        if (broadcastData.error) throw new Error(`YouTube API Error (Broadcast): ${broadcastData.error.message}`);
        const broadcastId = broadcastData.id; 

        // 5. Crear el Stream (Clave)
        const streamRes = await fetch('https://youtube.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn', {
            method: 'POST',
            headers: ytHeaders,
            body: JSON.stringify({
                snippet: { title: `Stream for: ${title}` },
                cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" }
            })
        });
        const streamData = await streamRes.json();
        if (streamData.error) throw new Error(`YouTube API Error (Stream): ${streamData.error.message}`);
        const streamId = streamData.id;
        const streamKey = streamData.cdn.ingestionInfo.streamName;
        const streamUrl = streamData.cdn.ingestionInfo.ingestionAddress;

        // 6. Unir Evento y Clave (Bind)
        const bindRes = await fetch(`https://youtube.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcastId}&streamId=${streamId}&part=id,contentDetails`, {
            method: 'POST', headers: ytHeaders
        });
        const bindData = await bindRes.json();
        if (bindData.error) throw new Error(`YouTube API Error (Bind): ${bindData.error.message}`);

        // --- 7. MAGIA NUEVA: SUBIR LA MINIATURA ---
        if (thumbnailUrl) {
            try {
                // Descargamos la imagen y la convertimos a binario estricto
                const imgRes = await fetch(thumbnailUrl);
                const arrayBuffer = await imgRes.arrayBuffer();
                const imageBytes = new Uint8Array(arrayBuffer);

                const thumbUploadUrl = `https://youtube.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${broadcastId}`;
                const thumbRes = await fetch(thumbUploadUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg'
                    },
                    body: imageBytes // Enviamos los bytes puros
                });
                
                const thumbData = await thumbRes.json();
                if (thumbData.error) console.error("Error subiendo miniatura:", thumbData.error.message);
            } catch (thumbErr) {
                console.error("Excepción procesando la miniatura:", thumbErr.message);
            }
        }
        // --- FIN MAGIA MINIATURA ---

        // 8. Retornar éxito
        return new Response(JSON.stringify({ 
            success: true, videoId: broadcastId, streamKey: streamKey, streamUrl: streamUrl 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
});