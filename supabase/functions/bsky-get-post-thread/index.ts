// CÓDIGO FINAL Y REQUERIDO para /supabase/functions/bsky-get-post-thread/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent } from 'npm:@atproto/api'
import { corsHeaders } from '../_shared/cors.ts'

const BSKY_SERVICE_URL = 'https://bsky.social'

function flattenThread(threadNode) {
  let posts = [];
  if (threadNode.post && threadNode.post.author && threadNode.post.record) { posts.push(threadNode.post); }
  if (threadNode.replies) {
    for (const reply of threadNode.replies) { posts = posts.concat(flattenThread(reply)); }
  }
  return posts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

  try {
    const { postUri } = await req.json();
    if (!postUri) throw new Error("Se requiere el 'postUri' para obtener el hilo.");

    // --- LÓGICA CORRECTA: Usamos credenciales de servicio (bot) para LEER hilos ---
    const serviceIdentifier = Deno.env.get('BSKY_HANDLE'); // Usamos tu secret BSKY_HANDLE
    const serviceAppPassword = Deno.env.get('BSKY_APP_PASSWORD');
    
    if (!serviceIdentifier || !serviceAppPassword) {
      throw new Error("Credenciales del servicio de Bluesky no configuradas en el servidor.");
    }
    
    const agent = new BskyAgent({ service: BSKY_SERVICE_URL });
    await agent.login({ identifier: serviceIdentifier, password: serviceAppPassword });

    const thread = await agent.getPostThread({ uri: postUri, depth: 100 });
    
    if (!thread.data.thread) {
      throw new Error("No se pudo encontrar el hilo para el URI proporcionado.");
    }
    
    const allPosts = flattenThread(thread.data.thread);
    const anchorPost = allPosts.shift(); 
    const replies = allPosts.sort((a, b) => new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime());

    return new Response(JSON.stringify({ anchorPost, messages: replies }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error en bsky-get-post-thread:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})