// Contenido COMPLETO para: /supabase/functions/bsky-create-anchor-post/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
      .select('did, handle, access_jwt, refresh_jwt')
      .eq('user_id', user.id)
      .single()
    if (credsError || !creds) throw new Error('El investigador no ha conectado su cuenta de Bluesky.')

    const { sessionTitle } = await req.json()
    if (!sessionTitle) throw new Error('El título de la sesión es requerido.')

    const agent = new BskyAgent({
      service: BSKY_SERVICE_URL,
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          await supabaseClient.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', user.id)
        }
      },
    })

    await agent.resumeSession({
        accessJwt: creds.access_jwt,
        refreshJwt: creds.refresh_jwt,
        did: creds.did,
        handle: creds.handle,
    });
    
    // Creamos el post ancla para el chat
    const postRecord = {
      text: `🔴 ¡EN VIVO AHORA!\n\n"${sessionTitle}"\n\nÚnete a la conversación en el chat de la transmisión en Epistecnología. #EPTLive`,
      createdAt: new Date().toISOString(),
    };
    
    const postResult = await agent.post(postRecord);

    return new Response(JSON.stringify({ uri: postResult.uri, cid: postResult.cid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error en bsky-create-anchor-post:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})