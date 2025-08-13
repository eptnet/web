// Contenido COMPLETO Y CORREGIDO para: /supabase/functions/bsky-create-reply/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { corsHeaders } from '../_shared/cors.ts'

const BSKY_SERVICE_URL = 'https://bsky.social'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado.');

    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('did, handle, access_jwt, refresh_jwt')
      .eq('user_id', user.id)
      .single();
    if (credsError || !creds) throw new Error('El usuario no ha conectado su cuenta de Bluesky.');

    const { replyText, parentPost } = await req.json();
    if (!replyText || !parentPost?.uri || !parentPost?.cid) {
      throw new Error('Faltan datos (texto, URI del post, CID del post) para publicar el comentario.');
    }

    const agent = new BskyAgent({
      service: BSKY_SERVICE_URL,
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          await supabaseClient.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', user.id);
        }
      },
    });
    
    // LA CORRECCIÓN CLAVE: Mapeamos los nombres de snake_case a camelCase
    await agent.resumeSession({
        accessJwt: creds.access_jwt,
        refreshJwt: creds.refresh_jwt,
        did: creds.did,
        handle: creds.handle,
    });

    // Construimos el objeto de respuesta para Bluesky
    await agent.post({
      text: replyText,
      reply: {
        root: { uri: parentPost.uri, cid: parentPost.cid }, // Para respuestas directas, root y parent son el mismo
        parent: { uri: parentPost.uri, cid: parentPost.cid }
      }
    });

    return new Response(JSON.stringify({ success: true, message: 'Comentario publicado' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });

  } catch (error) {
    console.error("Error en bsky-create-reply:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});