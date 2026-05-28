import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BskyAgent, RichText } from 'npm:@atproto/api'

serve(async (req) => {
  try {
    // 1. Recibir los datos del Trigger de Supabase
    const payload = await req.json();
    const record = payload.record;

    // Si no hay record, o ya fue saludado (la bandera es true), abortamos silenciosamente.
    if (!record || record.bot_welcomed === true) {
        return new Response("Usuario ya saludado o payload inválido. Ignorando.", { status: 200 });
    }

    const handle = record.handle;
    const userId = record.user_id;

    if (!handle) {
        return new Response("No se encontró el handle del usuario.", { status: 400 });
    }

    console.log(`🚀 Iniciando protocolo de bienvenida para: @${handle}`);

    // 2. Despertar al Bot usando sus variables de entorno
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({
        identifier: Deno.env.get('BSKY_HANDLE')!,
        password: Deno.env.get('BSKY_APP_PASSWORD')!,
    });

    // 3. Escribir el mensaje (Puedes personalizar este texto como quieras)
    const text = `¡Demos una cálida bienvenida a nuestro nuevo investigador @${handle}! 🎉\n\nYa es parte oficial del Ágora. Nos emociona mucho leer tus futuros aportes.\n\n#EPTcomunidad`;
    
    // Usamos RichText para que Bluesky convierta el @handle en un link y envíe la notificación
    const rt = new RichText({ text });
    await rt.detectFacets(agent);

    // 4. Publicar el saludo en el feed global
    await agent.post({
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString()
    });

    console.log("✅ Saludo publicado con éxito.");

    // 5. Levantar la Bandera: Marcar al usuario como saludado en la BD
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    await supabaseAdmin.from('bsky_credentials')
        .update({ bot_welcomed: true })
        .eq('user_id', userId);

    return new Response("Proceso completado exitosamente", { status: 200 });

  } catch (error) {
    console.error("💥 Error en el bot de bienvenida:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});