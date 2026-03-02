// ARCHIVO: supabase/functions/render-public-room/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Obtener el ID de la sesión. 
    // Asumimos que lo llamaremos así: https://tu-proyecto.supabase.co/functions/v1/render-public-room?id=251
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
        return new Response("ID de sesión no proporcionado", { status: 400 });
    }

    // 2. Conectar a Supabase usando credenciales de Admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Buscar los datos de la sesión
    const { data: session, error } = await supabase
        .from('sessions')
        .select('session_title, description, thumbnail_url')
        .eq('id', id)
        .single();

    if (error || !session) {
        return new Response("Sesión no encontrada", { status: 404 });
    }

    // 4. Preparar los Metadatos
    const title = session.session_title || 'Evento en vivo de Epistecnología';
    const description = session.description || 'Únete a nuestro evento en vivo y participa en el debate.';
    const image = session.thumbnail_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png';
    const urlPage = `https://epistecnologia.com/l/${id}`;

    // 5. Construir el HTML mágico (El cebo para los robots de WhatsApp/Bluesky)
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - Epistecnología</title>
        
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
        <meta property="og:url" content="${urlPage}" />
        <meta property="og:type" content="website" />
        
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${title}">
        <meta name="twitter:description" content="${description}">
        <meta name="twitter:image" content="${image}">

        <script>
            window.location.replace("https://epistecnologia.com/l/${id}");
        </script>
    </head>
    <body style="background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding-top: 50px;">
        <p>Cargando la sala pública de Epistecnología...</p>
        <p>Si no eres redirigido, <a href="https://epistecnologia.com/l/${id}" style="color: #38bdf8;">haz clic aquí</a>.</p>
    </body>
    </html>
    `;

    // 6. Enviar el HTML como respuesta oficial
    return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  } catch (err) {
    console.error(err);
    return new Response("Error interno del servidor", { status: 500 });
  }
})