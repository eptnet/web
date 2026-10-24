import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'https://deno.land/x/xml@2.1.3/mod.ts';

Deno.serve(async (req) => {
  try {
    const SUBSTACK_RSS_URL = 'https://epistecnologia.substack.com/feed'; 
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("⏳ Iniciando sincronización con Substack...");

    const response = await fetch(SUBSTACK_RSS_URL);
    const xmlText = await response.text();
    const data = parse(xmlText);
    const items = data.rss.channel.item;

    console.log(`✅ Se encontraron ${items.length} artículos en el RSS.`);

    const articles = items.map((item: any) => {
      let authorName = "Epistecnología";
      if (item["dc:creator"]) authorName = item["dc:creator"];
      if (authorName.includes("Henry") || authorName.includes("Epistec")) {
          authorName = "Henry Adolfo Márquez Mercado";
      }

      let desc = item.description || "";
      desc = desc.replace(/<[^>]*>?/gm, ''); 
      if (desc.length > 200) desc = desc.substring(0, 200) + "...";

      let img = null;
      if (item.enclosure && item.enclosure["@url"] && item.enclosure["@type"]?.includes("image")) {
          img = item.enclosure["@url"];
      } else if (item["media:content"] && item["media:content"]["@url"]) {
          img = item["media:content"]["@url"];
      } else if (item["itunes:image"] && item["itunes:image"]["@href"]) {
          img = item["itunes:image"]["@href"];
      }

      let type = 'publicación'; 
      let audioUrl = null; // <-- NUEVO CABLE PARA EL AUDIO

      // Detectamos si es podcast y extraemos el MP3
      if (item.enclosure && item.enclosure["@type"]?.includes("audio")) {
          type = 'podcast';
          audioUrl = item.enclosure["@url"]; // <-- EXTRAEMOS EL ENLACE DEL MP3
      }

      return {
        title: item.title,
        url: item.link,
        author_name: authorName,
        published_at: new Date(item.pubDate).toISOString(),
        description: desc,
        image_url: img,  
        source_type: type, 
        audio_url: audioUrl, // <-- GUARDAMOS EN LA TABLA
        created_at: new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from('knowledge_base')
      .upsert(articles, { onConflict: 'url' });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, count: articles.length }), {
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