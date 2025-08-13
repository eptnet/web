// Contenido COMPLETO para: /supabase/functions/bsky-like-post/index.ts

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
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado.')

    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('access_jwt, refresh_jwt, did, handle')
      .eq('user_id', user.id)
      .single()
    if (credsError || !creds) throw new Error('El usuario no ha conectado su cuenta de Bluesky.')

    const { postUri, postCid, likeUri } = await req.json()

    const agent = new BskyAgent({
      service: BSKY_SERVICE_URL,
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          await supabaseClient
            .from('bsky_credentials')
            .update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt })
            .eq('user_id', user.id)
        }
      },
    })

    await agent.resumeSession({
        accessJwt: creds.access_jwt,
        refreshJwt: creds.refresh_jwt,
        did: creds.did,
        handle: creds.handle,
    });

    // --- LÓGICA PARA LIKE Y UNLIKE ---
    if (likeUri) {
      // Si recibimos un likeUri, significa que queremos borrar el 'Me Gusta'
      await agent.deleteLike(likeUri);
      return new Response(JSON.stringify({ success: true, message: 'Like eliminado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    } else {
      // Si no, damos 'Me Gusta' como antes
      if (!postUri || !postCid) throw new Error('Faltan datos del post (URI y CID).')
      const likeResult = await agent.like(postUri, postCid);
      // Devolvemos el URI del nuevo like para que el frontend lo guarde
      return new Response(JSON.stringify({ success: true, message: 'Post likeado', uri: likeResult.uri }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

  } catch (error) {
    console.error("Error en la función bsky-like-post:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
})