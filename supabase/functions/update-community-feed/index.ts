// ARCHIVO FINAL Y CORREGIDO: /supabase/functions/update-community-feed/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent } from 'npm:@atproto/api'

const BSKY_SERVICE_URL = 'https://bsky.social'
const CACHE_LIMIT = 200;

serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: members, error: membersError } = await supabaseAdmin.from('community_members').select('did');
    if (membersError) throw membersError;
    if (!members || members.length === 0) return new Response("OK - No members to fetch", { status: 200 });
    
    const communityDids = members.map(m => m.did);

    const agent = new BskyAgent({ service: BSKY_SERVICE_URL });
    await agent.login({
      identifier: Deno.env.get('BSKY_HANDLE')!,
      password: Deno.env.get('BSKY_APP_PASSWORD')!,
    });

    const feedPromises = communityDids.map(did => agent.getAuthorFeed({ actor: did, limit: 50 }));
    const memberFeeds = await Promise.all(feedPromises);
    const allPostsRaw = memberFeeds.flatMap(response => response.data.feed);
    const topLevelPostsOnly = allPostsRaw.filter(item => !item.reply);

    if (topLevelPostsOnly.length === 0) return new Response("OK - No new posts found", { status: 200 });

    const postsToCache = topLevelPostsOnly.map(({ post }) => {
        const postData = {
            uri: post.uri, cid: post.cid,
            author_did: post.author.did, author_handle: post.author.handle,
            author_display_name: post.author.displayName, author_avatar_url: post.author.avatar,
            post_text: post.record.text, reply_count: post.replyCount || 0,
            repost_count: post.repostCount || 0, like_count: post.likeCount || 0,
            indexed_at: post.indexedAt,
            embed_image_url: null, embed_external_uri: null,
            embed_external_title: null, embed_external_description: null,
            embed_external_thumb: null,
        };

        if (post.embed) {
            // --- INICIO DE LA CORRECCIÓN CLAVE ---
            // Usamos startsWith() para ignorar el sufijo '#view'
            if (post.embed.$type.startsWith('app.bsky.embed.images') && post.embed.images) {
                postData.embed_image_url = post.embed.images[0]?.thumb;
            } 
            else if (post.embed.$type.startsWith('app.bsky.embed.external') && post.embed.external) {
                postData.embed_external_uri = post.embed.external.uri;
                postData.embed_external_title = post.embed.external.title;
                postData.embed_external_description = post.embed.external.description;
                postData.embed_external_thumb = post.embed.external.thumb;
            }
            // --- FIN DE LA CORRECCIÓN CLAVE ---
        }
        return postData;
    });
    
    await supabaseAdmin.from('community_feed_cache').upsert(postsToCache, { onConflict: 'uri' });
    
    const { data: urisToKeep } = await supabaseAdmin.from('community_feed_cache').select('uri').order('indexed_at', { ascending: false }).limit(CACHE_LIMIT);

    if (urisToKeep && urisToKeep.length >= CACHE_LIMIT) {
        const listOfUris = urisToKeep.map(item => item.uri);
        await supabaseAdmin.from('community_feed_cache').delete().not('uri', 'in', `(${listOfUris.map(uri => `'${uri}'`).join(',')})`);
    }
    
    return new Response("OK - Feed cache updated successfully", { status: 200 });
  } catch (error) {
    console.error("Error in update-community-feed:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});