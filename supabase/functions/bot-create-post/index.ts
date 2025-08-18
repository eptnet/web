// ARCHIVO: /supabase/functions/bot-create-post/index.ts (Versión con Atribución Mejorada)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent } from 'npm:@atproto/api'

const BSKY_SERVICE_URL = 'https://bsky.social'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
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
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error("Acción no autorizada: se requiere iniciar sesión.")

    const { postText, authorInfo } = await req.json()
    if (!postText || !authorInfo) {
        throw new Error("Faltan datos para la publicación (texto y autor).")
    }

    // --- INICIO DE LA LÓGICA DE ATRIBUCIÓN MEJORADA ---
    let finalPostText = '';
    const { displayName, handle, orcid } = authorInfo;

    if (handle) {
        // Si el autor tiene un handle de Bluesky, la atribución es un simple "by"
        finalPostText = `${postText}\n\n✍️ por @${handle}`;
    } else {
        // Si no, usamos el Nombre y el enlace ORCID
        const authorName = displayName || 'un miembro de la comunidad';
        const orcidLink = orcid ? orcid.replace('https://', '') : ''; // Quitamos https:// para ahorrar caracteres
        
        finalPostText = `${postText}\n\n✍️ por ${authorName}\n${orcidLink}`;
    }
    // --- FIN DE LA LÓGICA DE ATRIBUCIÓN MEJORADA ---

    const agent = new BskyAgent({ service: BSKY_SERVICE_URL });
    await agent.login({
      identifier: Deno.env.get('BSKY_HANDLE')!,
      password: Deno.env.get('BSKY_APP_PASSWORD')!,
    });
    
    await agent.post({ text: finalPostText });

    return new Response(JSON.stringify({ success: true, message: "Publicado en la comunidad por el Bot" }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en la función bot-create-post:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})