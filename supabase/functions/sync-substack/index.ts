import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'https://deno.land/x/xml@2.1.3/mod.ts';

Deno.serve(async (req) => {
  try {
    // 1. Las dos fuentes EXACTAS que usabas en tu app.js original
    const ARTICLES_RSS_URL = 'https://eptnews.substack.com/feed'; 
    const PODCAST_RSS_URL = 'https://api.substack.com/feed/podcast/2867518/s/186951.rss';

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("⏳ Iniciando sincronización dual con Substack...");

    // 2. Traemos ambos feeds a la vez
    const [articlesResponse, podcastsResponse] = await Promise.all([
      fetch(ARTICLES_RSS_URL),
      fetch(PODCAST_RSS_URL)
    ]);

    const articlesXml = await articlesResponse.text();
    const podcastsXml = await podcastsResponse.text();

    const articlesData = parse(articlesXml);
    const podcastsData = parse(podcastsXml);

    const articleItems = articlesData.rss?.channel?.item || [];
    const podcastItems = podcastsData.rss?.channel?.item || [];

    // Función para asegurar que siempre sea un array (por si solo hay 1 artículo)
    const normalizeArray = (data: any) => Array.isArray(data) ? data : (data ? [data] : []);

    // 3. Unimos todo y forzamos el tipo según de qué feed vino
    const allItems = [
        ...normalizeArray(articleItems).map(item => ({...item, _forced_type: 'publicación'})),
        ...normalizeArray(podcastItems).map(item => ({...item, _forced_type: 'podcast'}))
    ];

    console.log(`✅ Se procesarán ${allItems.length} elementos en total.`);

    const records = allItems.map((item: any) => {
      // Autor
      let authorName = "Epistecnología";
      if (item["dc:creator"]) authorName = item["dc:creator"];
      if (item["itunes:author"]) authorName = item["itunes:author"];
      if (authorName.includes("Henry") || authorName.includes("Epistec")) {
          authorName = "Henry Adolfo Márquez Mercado";
      }

      // Descripción limpia
      let desc = item.description || "";
      desc = desc.replace(/<[^>]*>?/gm, ''); 
      if (desc.length > 200) desc = desc.substring(0, 200) + "...";

      // Imagen
      let img = null;
      if (item.enclosure && item.enclosure["@url"] && item.enclosure["@type"]?.includes("image")) {
          img = item.enclosure["@url"];
      } else if (item["media:content"] && item["media:content"]["@url"]) {
          img = item["media:content"]["@url"];
      } else if (item["itunes:image"] && item["itunes:image"]["@href"]) {
          img = item["itunes:image"]["@href"];
      }

      // Audio (MP3)
      let type = item._forced_type; 
      let audioUrl = null;
      
      // Si la etiqueta enclosure trae un enlace y es un audio (típico de podcast)
      if (item.enclosure && item.enclosure["@url"]) {
          if (item.enclosure["@type"]?.includes("audio") || type === 'podcast') {
             audioUrl = item.enclosure["@url"];
          }
      }

      return {
        title: item.title,
        url: item.link,
        author_name: authorName,
        published_at: new Date(item.pubDate).toISOString(),
        description: desc,
        image_url: img,  
        source_type: type, 
        audio_url: audioUrl, // <-- AHORA SÍ LLEGARÁN LOS MP3
        created_at: new Date().toISOString()
      };
    });

    // 4. Guardamos en la Base de Datos
    const { error } = await supabase
      .from('knowledge_base')
      .upsert(records, { onConflict: 'url' });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, count: records.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});