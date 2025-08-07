// ARCHIVO: /supabase/functions/bsky-get-community-feed/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent } from 'npm:@atproto/api'

const BSKY_SERVICE_URL = 'https://bsky.social'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (_req) => {
  if (_req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. Creamos un cliente de Supabase con permisos de administrador para leer la tabla de miembros.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Obtenemos la lista de DIDs de nuestra tabla `community_members`.
    const { data: members, error: membersError } = await supabaseAdmin
      .from('community_members')
      .select('did');
      
    if (membersError) throw membersError;
    if (!members || members.length === 0) {
      return new Response(JSON.stringify([]), { // Devuelve un array vacío si no hay miembros
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    const communityDids = members.map(m => m.did);

    // 3. Iniciamos sesión en Bluesky con nuestra cuenta "bot" (cargada desde los secrets).
    const agent = new BskyAgent({ service: BSKY_SERVICE_URL });
    await agent.login({
      identifier: Deno.env.get('BSKY_HANDLE')!,
      password: Deno.env.get('BSKY_APP_PASSWORD')!,
    });

    // 4. Obtenemos el feed de cada miembro de forma concurrente para mayor velocidad.
    const feedPromises = communityDids.map(did => 
      agent.getAuthorFeed({ actor: did, limit: 10 })
    );
    const memberFeeds = await Promise.all(feedPromises);

    // 5. Unimos todos los posts de todos los feeds en un solo array.
    const allPosts = memberFeeds.flatMap(response => response.data.feed);

    // 6. Ordenamos todos los posts por fecha, del más reciente al más antiguo.
    allPosts.sort((a, b) => new Date(b.post.indexedAt).getTime() - new Date(a.post.indexedAt).getTime());
    
    // 7. Limitamos el resultado final a los 30 posts más recientes de toda la comunidad.
    const finalFeed = allPosts.slice(0, 30);

    // 8. Devolvemos el feed combinado al frontend.
    return new Response(JSON.stringify(finalFeed), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error en la función bsky-get-community-feed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});