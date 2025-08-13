// Contenido COMPLETO Y CORREGIDO para: /supabase/functions/bsky-get-post-thread/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const BSKY_SERVICE_URL = 'https://bsky.social'

function flattenThread(threadNode) {
  let posts = [];
  if (threadNode.post && threadNode.post.author && threadNode.post.record) {
    posts.push(threadNode.post);
  }
  if (threadNode.replies) {
    for (const reply of threadNode.replies) {
      posts = posts.concat(flattenThread(reply));
    }
  }
  return posts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado.')

    // --- INICIO DE LA CORRECCIÓN ---
    // Obtenemos las credenciales del usuario para autenticar la solicitud a Bluesky
    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('did, handle, access_jwt, refresh_jwt')
      .eq('user_id', user.id)
      .single()
    if (credsError || !creds) throw new Error('El usuario no ha conectado su cuenta de Bluesky.')

    const { postUri } = await req.json();
    if (!postUri) throw new Error("Se requiere el 'postUri' para obtener el hilo.");

    const agent = new BskyAgent({ 
      service: BSKY_SERVICE_URL,
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          await supabaseClient.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', user.id)
        }
      },
    });

    // Reanudamos la sesión antes de hacer la llamada
    await agent.resumeSession({
        accessJwt: creds.access_jwt,
        refreshJwt: creds.refresh_jwt,
        did: creds.did,
        handle: creds.handle,
    });
    // --- FIN DE LA CORRECCIÓN ---

    const thread = await agent.getPostThread({ uri: postUri, depth: 100 });
    
    if (!thread.data.thread) {
      throw new Error("No se pudo encontrar el hilo para el URI proporcionado.");
    }
    
    const allPosts = flattenThread(thread.data.thread);
    const anchorPost = allPosts.shift(); 
    const replies = allPosts.sort((a, b) => new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime());

    const chatData = {
      anchorPost: anchorPost,
      messages: replies
    };

    return new Response(JSON.stringify(chatData), {
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