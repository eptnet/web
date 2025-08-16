// ARCHIVO ACTUALIZADO: /supabase/functions/bsky-get-community-feed/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (_req) => {
  if (_req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    // Ahora seleccionamos todas las columnas, incluidas las nuevas
    const { data: cachedFeed, error } = await supabaseAdmin
      .from('community_feed_cache').select('*').order('indexed_at', { ascending: false }).limit(50);
    if (error) throw error;

    const finalFeed = cachedFeed.map(post => {
      // --- INICIO DE LA MODIFICACIÓN ---
      let embed = undefined;
      if (post.embed_image_url) {
        embed = { $type: 'app.bsky.embed.images', images: [{ thumb: post.embed_image_url, alt: '' }] };
      } else if (post.embed_external_uri) {
        embed = {
          $type: 'app.bsky.embed.external',
          external: {
            uri: post.embed_external_uri,
            title: post.embed_external_title,
            description: post.embed_external_description,
            thumb: post.embed_external_thumb
          }
        };
      }
      // --- FIN DE LA MODIFICACIÓN ---

      return {
        post: {
            uri: post.uri, cid: post.cid,
            author: { did: post.author_did, handle: post.author_handle, displayName: post.author_display_name, avatar: post.author_avatar_url },
            record: { text: post.post_text },
            embed: embed, // Usamos el objeto embed que construimos
            replyCount: post.reply_count, repostCount: post.repost_count, likeCount: post.like_count,
            indexedAt: post.indexed_at,
            viewer: {} 
        }
      };
    });
    return new Response(JSON.stringify(finalFeed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    console.error("Error en bsky-get-community-feed:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})