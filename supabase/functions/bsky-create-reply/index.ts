// ARCHIVO COMPLETO Y DEFINITIVO: /supabase/functions/bsky-create-reply/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'

const BSKY_SERVICE_URL = 'https://bsky.social'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
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
      .select('access_jwt, refresh_jwt, did, handle')
      .eq('user_id', user.id)
      .single();
    if (credsError || !creds) throw new Error('El usuario no ha conectado su cuenta de Bluesky.');

    const { replyText, parentPost } = await req.json();
    if (!replyText || !parentPost?.parent?.uri || !parentPost?.root?.uri) {
      throw new Error('Faltan datos para publicar el comentario.');
    }

    const agent = new BskyAgent({
      service: BSKY_SERVICE_URL,
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          await supabaseClient.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', user.id);
        }
      },
    });
    await agent.resumeSession({ ...creds });

    const replyObject = {
      text: replyText,
      reply: {
        root: parentPost.root,
        parent: parentPost.parent
      }
    };
    console.log('Enviando a Bluesky el siguiente objeto de respuesta:', JSON.stringify(replyObject, null, 2));

    await agent.post(replyObject);

    return new Response(JSON.stringify({ success: true, message: 'Comentario publicado con éxito' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error en la función bsky-create-reply:", error);
    if (error.error === 'InvalidToken' || error.message.includes('Token could not be verified')) {
        return new Response(JSON.stringify({ 
            error: 'Tu sesión de Bluesky ha expirado. Por favor, desconecta y vuelve a conectar tu cuenta en tu perfil.' 
        }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});