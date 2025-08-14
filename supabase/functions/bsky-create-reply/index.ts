// /supabase/functions/bsky-create-reply/index.ts
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

    // Este cliente tiene permisos de administrador para poder usar Realtime desde el servidor
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { replyText, parentPost } = await req.json();
    if (!replyText || !parentPost) throw new Error("Faltan datos para crear la respuesta.");

    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials').select('*').eq('user_id', user.id).single()
    if (credsError || !creds) throw new Error('El usuario no tiene credenciales de Bluesky.')

    const agent = new BskyAgent({ 
      service: BSKY_SERVICE_URL,
      async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
        if (evt === 'update' && session) {
          await supabaseClient.from('bsky_credentials').update({ access_jwt: session.accessJwt, refresh_jwt: session.refreshJwt }).eq('user_id', user.id)
        }
      },
    });

    await agent.resumeSession({
        accessJwt: creds.access_jwt,
        refreshJwt: creds.refresh_jwt,
        did: creds.did,
        handle: creds.handle,
    });

    const reply = { text: replyText, createdAt: new Date().toISOString() };
    const parentRef = { uri: parentPost.uri, cid: parentPost.cid };

    const postRecord = await agent.post({
      $type: 'app.bsky.feed.post',
      text: reply.text,
      reply: { root: parentRef, parent: parentRef },
      createdAt: reply.createdAt,
    });
    
    // --- LÓGICA DE ACTUALIZACIÓN EN TIEMPO REAL ---
    const { data: profile } = await supabaseClient.from('profiles').select('display_name, avatar_url').eq('id', user.id).single();

    // Preparamos el mensaje que se enviará a todos los clientes
    const messagePayload = {
        author: {
            avatar: profile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png',
            displayName: profile?.display_name || 'Usuario',
            handle: creds.handle,
        },
        record: { text: replyText },
        uri: postRecord.uri // Identificador único del mensaje
    };

    // Obtenemos el ID de la sesión del URI del post para nombrar el canal
    // Un URI de Bluesky tiene el formato: at://did:plc:abcd/app.bsky.feed.post/3k25j4d42b22a
    // El ID de nuestro sistema está en la DB, así que extraemos el 'rkey' del post padre.
    const rkey = parentPost.uri.split('/').pop();
    const { data: sessionData } = await supabaseAdmin.from('sessions').select('id').eq('bsky_chat_thread_uri', parentPost.uri).single();

    if (sessionData) {
        const channelName = `session-chat-${sessionData.id}`;
        const channel = supabaseAdmin.channel(channelName);

        // Enviamos el payload a todos los clientes suscritos
        await channel.send({
          type: 'broadcast',
          event: 'new_chat_message',
          payload: messagePayload,
        });
    }
    // --- FIN DE LA LÓGICA DE REALTIME ---

    return new Response(JSON.stringify({ success: true, uri: postRecord.uri }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })

  } catch (error) {
    console.error("Error en bsky-create-reply:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
})