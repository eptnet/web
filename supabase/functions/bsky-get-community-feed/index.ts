// ARCHIVO: /supabase/functions/bsky-get-community-feed/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (_req) => {
  if (_req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: cachedFeed, error } = await supabaseAdmin
      .from('community_feed_cache')
      .select('*')
      .order('indexed_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const finalFeed = cachedFeed.map(post => ({
        post: {
            uri: post.uri,
            cid: post.cid,
            author: {
                did: post.author_did,
                handle: post.author_handle,
                displayName: post.author_display_name,
                avatar: post.author_avatar_url,
            },
            record: { text: post.post_text },
            embed: post.embed_image_url ? { images: [{ thumb: post.embed_image_url, alt: '' }] } : undefined,
            replyCount: post.reply_count,
            repostCount: post.repost_count,
            likeCount: post.like_count,
            indexedAt: post.indexed_at,
            viewer: {} 
        }
    }));

    return new Response(JSON.stringify(finalFeed), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error en bsky-get-community-feed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})