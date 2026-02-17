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
      // 1. Autor
      let authorName = "Epistecnología";
      if (item["dc:creator"]) authorName = item["dc:creator"];
      if (authorName.includes("Henry") || authorName.includes("Epistec")) {
          authorName = "Henry Adolfo Márquez Mercado";
      }

      // 2. Descripción (Resumen corto)
      // Limpiamos etiquetas HTML simples si vienen en la descripción
      let desc = item.description || "";
      // Truco para quitar HTML básico (regex simple)
      desc = desc.replace(/<[^>]*>?/gm, ''); 
      if (desc.length > 200) desc = desc.substring(0, 200) + "...";

      // 3. Imagen (Intentamos buscarla en varios lugares estándar del RSS)
      let img = null;
      if (item.enclosure && item.enclosure["@url"] && item.enclosure["@type"]?.includes("image")) {
          img = item.enclosure["@url"];
      } else if (item["media:content"] && item["media:content"]["@url"]) {
          img = item["media:content"]["@url"];
      } else if (item["itunes:image"] && item["itunes:image"]["@href"]) {
          img = item["itunes:image"]["@href"];
      }

      // 4. Tipo (Publicación vs Podcast)
      // Si tiene un enclosure de audio, es podcast. Si no, es publicación.
      let type = 'publicación'; // Por defecto "publicación" en español
      if (item.enclosure && item.enclosure["@type"]?.includes("audio")) {
          type = 'podcast';
      }

      return {
        title: item.title,
        url: item.link,
        author_name: authorName,
        published_at: new Date(item.pubDate).toISOString(),
        description: desc,
        image_url: img,  // Guardamos la imagen
        source_type: type, // Guardamos el tipo nuevo
        created_at: new Date().toISOString()
      };
    });

    // Upsert
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