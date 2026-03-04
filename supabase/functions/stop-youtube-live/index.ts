import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

    try {
        const { broadcastId } = await req.json();
        if (!broadcastId) throw new Error("Se requiere el ID del video (broadcastId).");

        const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
        const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
        const refreshToken = Deno.env.get('YOUTUBE_REFRESH_TOKEN');

        // 1. Obtener Token fresco
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
        });
        const { access_token } = await tokenRes.json();

        // 2. Ejecutar la orden a YouTube: STATUS = COMPLETE (Detiene grabación permanentemente)
        const stopRes = await fetch(`https://youtube.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${broadcastId}&part=id,status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${access_token}` }
        });
        
        const stopData = await stopRes.json();
        if (stopData.error) throw new Error(stopData.error.message);

        return new Response(JSON.stringify({ success: true, status: 'complete' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error("Error al detener YouTube:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});