// ARCHIVO: /supabase/functions/update-community-feed/index.ts

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

    const { data: members, error: membersError } = await supabaseAdmin
      .from('community_members')
      .select('did');
    if (membersError) throw membersError;
    if (!members || members.length === 0) {
      return new Response("OK - No members to fetch", { status: 200 });
    }
    const communityDids = members.map(m => m.did);

    const agent = new BskyAgent({ service: BSKY_SERVICE_URL });
    await agent.login({
      identifier: Deno.env.get('BSKY_HANDLE')!,
      password: Deno.env.get('BSKY_APP_PASSWORD')!,
    });

    const feedPromises = communityDids.map(did => agent.getAuthorFeed({ actor: did, limit: 20 }));
    const memberFeeds = await Promise.all(feedPromises);
    const allPosts = memberFeeds.flatMap(response => response.data.feed);

    if (allPosts.length === 0) {
      return new Response("OK - No new posts found", { status: 200 });
    }

    const postsToCache = allPosts.map(({ post }) => ({
      uri: post.uri,
      cid: post.cid,
      author_did: post.author.did,
      author_handle: post.author.handle,
      author_display_name: post.author.displayName,
      author_avatar_url: post.author.avatar,
      post_text: post.record.text,
      embed_image_url: post.embed?.images?.[0]?.thumb || null,
      reply_count: post.replyCount || 0,
      repost_count: post.repostCount || 0,
      like_count: post.likeCount || 0,
      indexed_at: post.indexedAt,
    }));
    
    const { error: upsertError } = await supabaseAdmin
      .from('community_feed_cache')
      .upsert(postsToCache, { onConflict: 'uri' });
    if (upsertError) throw upsertError;

    const { data: urisToKeep, error: selectError } = await supabaseAdmin
      .from('community_feed_cache')
      .select('uri')
      .order('indexed_at', { ascending: false })
      .limit(CACHE_LIMIT);
    if (selectError) throw selectError;

    if (urisToKeep.length >= CACHE_LIMIT) {
        const listOfUris = urisToKeep.map(item => item.uri);
        const { error: deleteError } = await supabaseAdmin
            .from('community_feed_cache')
            .delete()
            .not('uri', 'in', `(${listOfUris.map(uri => `'${uri}'`).join(',')})`);
        if (deleteError) throw deleteError;
    }
    
    return new Response("OK - Feed cache updated successfully", { status: 200 });
  } catch (error) {
    console.error("Error in update-community-feed:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});