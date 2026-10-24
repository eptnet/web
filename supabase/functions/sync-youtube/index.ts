import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Tu ID real de YouTube
const YOUTUBE_CHANNEL_ID = 'UCg3ms3gecQ-2cjMhJwaPAig'; 
// Codificamos la URL para pasarla segura a rss2json
const YOUTUBE_RSS = encodeURIComponent(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
// Usamos tu API Key de app.js para asegurar el acceso sin límites
const API_KEY = 'rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua';
const FETCH_URL = `https://api.rss2json.com/v1/api.json?rss_url=${YOUTUBE_RSS}&api_key=${API_KEY}`;

serve(async (req) => {
    try {
        console.log("🚀 Iniciando sincronización de YouTube vía rss2json...");
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Hacemos la petición al servicio autorizado de rss2json
        const response = await fetch(FETCH_URL);
        if (!response.ok) throw new Error(`Error contactando a rss2json (HTTP ${response.status})`);
        
        const data = await response.json();
        if (data.status !== 'ok') throw new Error(`rss2json devolvió error: ${data.message}`);

        const videosToInsert = [];

        // Procesamos los videos que nos devuelve
        for (const item of data.items) {
            // Extraer el ID exacto del video (ej. desde yt:video:ID)
            let videoId = null;
            if (item.guid && item.guid.includes('yt:video:')) {
                videoId = item.guid.split('yt:video:')[1];
            } else if (item.link) {
                const match = item.link.match(/v=([^&]+)/);
                if (match) videoId = match[1];
            }

            if (videoId && item.title) {
                // Limpiamos la descripción de cualquier etiqueta HTML residual
                let cleanDesc = item.description || 'Sin descripción';
                cleanDesc = cleanDesc.replace(/<[^>]*>?/gm, '');

                videosToInsert.push({
                    youtube_video_id: videoId,
                    title: item.title,
                    description: cleanDesc.substring(0, 600)
                });
            }
        }

        let upsertedCount = 0;
        if (videosToInsert.length > 0) {
            const { error } = await supabase
                .from('ondemand_videos')
                .upsert(videosToInsert, { onConflict: 'youtube_video_id' });

            if (error) throw error;
            upsertedCount = videosToInsert.length;
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Sincronización exitosa. ${upsertedCount} videos guardados.` 
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error("❌ Error en sync-youtube:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { 
            headers: { 'Content-Type': 'application/json' },
            status: 500 
        });
    }
});