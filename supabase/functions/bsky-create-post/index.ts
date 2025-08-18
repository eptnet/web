// Contenido FINAL Y COMPLETO para: supabase/functions/bsky-create-post/index.ts
// Integra la lógica de subida de imágenes en tu versión de depuración.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Buffer } from "https://deno.land/std@0.170.0/node/buffer.ts"; // Necesario para decodificar la imagen

const BSKY_SERVICE_URL = 'https://bsky.social'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("bsky-create-post: Función iniciada.");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error("Usuario no autenticado.")
    console.log(`Paso 1: Usuario verificado con ID: ${user.id}`);

    const { data: creds, error: credsError } = await supabaseClient
      .from('bsky_credentials')
      .select('did, handle, access_jwt, refresh_jwt')
      .eq('user_id', user.id)
      .single()
    if (credsError || !creds) throw new Error("Credenciales de Bluesky no encontradas para este usuario.")
    console.log(`Paso 2: Credenciales encontradas para el handle: @${creds.handle}`);
    
    const { count: memberCount, error: memberError } = await supabaseClient
      .from('community_members')
      .select('did', { count: 'exact', head: true })
      .eq('did', creds.did)
    if (memberError) throw memberError
    if (memberCount === 0) throw new Error("El usuario no tiene permisos para publicar.")
    console.log(`Paso 4: Verificación de membresía exitosa.`);

    // --- INICIO DE LA MODIFICACIÓN 1 ---
    // Ahora aceptamos también los datos de la imagen desde el frontend.
    const { postText, base64Image, imageMimeType } = await req.json()
    if (!postText && !base64Image) {
        throw new Error("El post debe contener texto o una imagen.")
    }
    console.log("Paso 5: Texto y/o datos de imagen recibidos.");
    // --- FIN DE LA MODIFICACIÓN 1 ---

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

    console.log("Paso 6: Reanudando sesión en Bluesky...");
    await agent.resumeSession({
        accessJwt: creds.access_jwt,
        refreshJwt: creds.refresh_jwt,
        did: creds.did,
        handle: creds.handle,
    });
    console.log("Paso 7: Sesión reanudada con éxito.");
    
    let imageEmbed = undefined;
    // --- INICIO DE LA MODIFICACIÓN 2: LÓGICA PARA SUBIR LA IMAGEN ---
    if (base64Image && imageMimeType) {
        console.log("Paso 7.1: Procesando imagen...");
        const imageBuffer = Buffer.from(base64Image, 'base64');

        const uploadResult = await agent.uploadBlob(imageBuffer, {
            encoding: imageMimeType
        });
        
        imageEmbed = {
            $type: 'app.bsky.embed.images',
            images: [{
                image: uploadResult.data.blob,
                alt: 'Imagen publicada desde Epistecnología'
            }]
        };
        console.log("Paso 7.2: Imagen procesada y lista para adjuntar.");
    }
    // --- FIN DE LA MODIFICACIÓN 2 ---

    console.log("Paso 8: Intentando publicar el post...");
    await agent.post({ 
        text: postText,
        embed: imageEmbed, // <-- Adjuntamos la imagen (si existe)
        createdAt: new Date().toISOString(),
        langs: ["es"]
    })
    console.log("Paso 9: ¡Post publicado con éxito!");

    return new Response(JSON.stringify({ message: "Post publicado con éxito" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error detallado en bsky-create-post:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})