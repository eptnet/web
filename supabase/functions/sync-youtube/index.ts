import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Reemplaza ESTO con tu ID real que empieza con UC
const YOUTUBE_CHANNEL_ID = 'UCg3ms3gecQ-2cjMhJwaPAig'; 
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;

serve(async (req) => {
    try {
        console.log("🚀 Iniciando sincronización con YouTube...");
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Disfrazamos la petición con cabeceras de un navegador real
        const response = await fetch(RSS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        if (!response.ok) throw new Error(`No se pudo contactar a YouTube (HTTP ${response.status})`);
        const xmlText = await response.text();

        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        const idRegex = /<yt:videoId>(.*?)<\/yt:videoId>/;
        const titleRegex = /<title>(.*?)<\/title>/;
        const descRegex = /<media:description>([\s\S]*?)<\/media:description>/;

        let match;
        let upsertedCount = 0;
        const videosToInsert = [];

        while ((match = entryRegex.exec(xmlText)) !== null) {
            const entryContent = match[1];
            const videoIdMatch = entryContent.match(idRegex);
            const titleMatch = entryContent.match(titleRegex);
            const descMatch = entryContent.match(descRegex);

            if (videoIdMatch && titleMatch) {
                videosToInsert.push({
                    youtube_video_id: videoIdMatch[1],
                    title: titleMatch[1],
                    description: descMatch ? descMatch[1].substring(0, 600) : 'Sin descripción'
                });
            }
        }

        if (videosToInsert.length > 0) {
            const { error } = await supabase
                .from('ondemand_videos')
                .upsert(videosToInsert, { onConflict: 'youtube_video_id' });

            if (error) throw error;
            upsertedCount = videosToInsert.length;
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Sincronización exitosa. ${upsertedCount} videos procesados.` 
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