import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent } from 'npm:@atproto/api'

const BSKY_SERVICE_URL = 'https://bsky.social'
const CACHE_LIMIT = 200;

serve(async (_req) => {
  try {
    console.log("--- 🚀 INICIANDO ESCANEO DE COMUNIDAD ---");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Obtener miembros
    const { data: members, error: membersError } = await supabaseAdmin.from('community_members').select('did');
    if (membersError) {
        console.error("❌ Error leyendo tabla community_members:", membersError);
        throw membersError;
    }
    
    let communityDids = members ? members.map(m => m.did) : [];
    console.log(`✅ Miembros encontrados en BD: ${communityDids.length}`);

    // 2. Conectar a Bluesky
    const agent = new BskyAgent({ service: BSKY_SERVICE_URL });
    await agent.login({
      identifier: Deno.env.get('BSKY_HANDLE')!,
      password: Deno.env.get('BSKY_APP_PASSWORD')!,
    });
    console.log(`✅ Bot conectado a Bluesky: ${agent.session?.did}`);

    if (agent.session && agent.session.did && !communityDids.includes(agent.session.did)) {
        communityDids.push(agent.session.did);
    }
    console.log(`🔍 Total de perfiles a escanear (Miembros + Bot): ${communityDids.length}`);

    if (communityDids.length === 0) return new Response("Sin perfiles", { status: 200 });

    // 3. Consultar Feeds
    const feedPromises = communityDids.map(did => agent.getAuthorFeed({ actor: did, limit: 30 }).catch(err => {
        console.error(`⚠️ Error trayendo feed de ${did}:`, err.message);
        return null;
    }));
    const memberFeeds = await Promise.all(feedPromises);

    // --- NUEVA LÓGICA ANTI-DUPLICADOS ---
    // Usamos un Map en lugar de un Array para garantizar que los 'uri' sean únicos
    let postsMap = new Map<string, any>();
    
    memberFeeds.forEach(feedResponse => {
        if (!feedResponse || !feedResponse.data || !feedResponse.data.feed) return;
        
        feedResponse.data.feed.forEach(item => {
            const post = item.post;

            // --- INICIO DEL FILTRO INTELIGENTE ---
            const postText = (post.record as any)?.text || '';
            const isBotAuthor = post.author.did === agent.session?.did;
            
            // Regla 1: ¿Tiene nuestra huella digital silenciosa?
            const hasCommunityTag = postText.includes('#EPTcomunidad');
            
            // Regla 2: ¿Es una respuesta a un hilo oficial (creado por el Bot)?
            // (Si un miembro comenta en la transmisión en vivo, queremos verlo aunque no use hashtag)
            const isReplyToBot = item.reply?.parent?.author?.did === agent.session?.did;

            // La Sentencia: Si NO es el bot publicando cosas oficiales, y NO tiene el hashtag, y NO es respuesta al bot... lo ignoramos.
            if (!isBotAuthor && !hasCommunityTag && !isReplyToBot) {
                return; // Saltamos este post, no entra a la caché
            }
            // --- FIN DEL FILTRO INTELIGENTE ---
            
            // Ignoramos los "Reposts"
            if (item.reason && item.reason.$type.includes('repost')) return;

            const postData = {
                uri: post.uri,
                cid: post.cid,
                author_did: post.author.did,
                author_handle: post.author.handle,
                author_display_name: post.author.displayName || post.author.handle,
                author_avatar_url: post.author.avatar || null,
                post_text: (post.record as any)?.text || '',
                reply_count: post.replyCount || 0,
                repost_count: post.repostCount || 0,
                like_count: post.likeCount || 0,
                indexed_at: (post.record as any)?.createdAt || new Date().toISOString(),
                cached_at: new Date().toISOString(),
                embed_image_url: null,
                embed_external_uri: null,
                embed_external_title: null,
                embed_external_description: null,
                embed_external_thumb: null,
                embed_video_thumb: null,
                embed_video_playlist: null
            };

            if (post.embed) {
                if (post.embed.$type.startsWith('app.bsky.embed.images') && (post.embed as any).images) {
                    postData.embed_image_url = (post.embed as any).images[0]?.thumb || null;
                } else if (post.embed.$type.startsWith('app.bsky.embed.external') && (post.embed as any).external) {
                    postData.embed_external_uri = (post.embed as any).external.uri;
                    postData.embed_external_title = (post.embed as any).external.title;
                    // --- ESTAS DOS LÍNEAS FALTABAN ---
                    postData.embed_external_description = (post.embed as any).external.description || null;
                    postData.embed_external_thumb = (post.embed as any).external.thumb || null;
                }
            }
            
            // Al usar .set(uri, data), si el post ya existe, simplemente lo sobreescribe.
            // Esto elimina matemáticamente cualquier duplicado en el lote.
            postsMap.set(postData.uri, postData);
        });
    });

    // Convertimos el mapa purificado de vuelta a un Array
    const postsToCache = Array.from(postsMap.values());
    console.log(`📦 Posts extraídos (Limpios sin duplicados): ${postsToCache.length}`);
    // ------------------------------------

    // 4. Guardar en Caché (Lo que ya tenías)
    if (postsToCache.length > 0) {
        const { error: upsertError } = await supabaseAdmin.from('community_feed_cache').upsert(postsToCache, { onConflict: 'uri' });
        if (upsertError) {
            console.error("❌ ERROR CRÍTICO AL INSERTAR EN LA TABLA:", upsertError);
            throw upsertError;
        }
        console.log("💾 Caché actualizada con éxito en la base de datos.");
    }

    return new Response("OK - Proceso completado", { status: 200 });

  } catch (error) {
    console.error("💥 ERROR GENERAL:", error.message || error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});