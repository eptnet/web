import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Lista de los "rastreadores" (bots) de las redes sociales más populares
const BOT_AGENTS = [
  "facebookexternalhit", "WhatsApp", "Twitterbot", "Slackbot",
  "TelegramBot", "LinkedInBot", "Discordbot", "vkShare", "SkypeUriPreview"
];

serve(async (req) => {
  const url = new URL(req.url);
  const postUri = url.searchParams.get("uri");
  const userAgent = req.headers.get("user-agent") || "";

  // 1. La URL de tu plataforma a donde queremos llevar el tráfico
  let targetUrl = "https://epistecnologia.com/comunidad.html";
  if (postUri) targetUrl += `?post=${encodeURIComponent(postUri)}`;

  // 2. ¿Es un Bot intentando generar la miniatura?
  const isBot = BOT_AGENTS.some(bot => userAgent.includes(bot));

  if (!isBot || !postUri) {
    // ES UN HUMANO: Lo redirigimos a la velocidad de la luz a tu comunidad
    return new Response(null, {
      status: 302,
      headers: { Location: targetUrl }
    });
  }

  // 3. ES UN BOT: Consultamos la API PÚBLICA de Bluesky (No usa tus llaves ni tu base de datos)
  try {
    const bskyUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${postUri}`;
    const res = await fetch(bskyUrl);
    const data = await res.json();

    const post = data.thread?.post;
    if (!post) throw new Error("Post no encontrado");

    const authorName = post.author?.displayName || post.author?.handle || "Usuario";
    const postText = post.record?.text || "Únete a la conversación en Epistecnología.";

    // Extraer la imagen si el post tiene una
    let imageUrl = "https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg"; // Tu portada por defecto
    if (post.embed?.images?.[0]?.thumb) {
        imageUrl = post.embed.images[0].thumb;
    } else if (post.embed?.external?.thumb) {
        imageUrl = post.embed.external.thumb;
    }

    // 4. Generamos las etiquetas Open Graph (OG) que leen WhatsApp y Facebook
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Aporte de ${authorName} en Epistecnología</title>
        <meta name="description" content="${postText}">

        <meta property="og:type" content="article">
        <meta property="og:url" content="${targetUrl}">
        <meta property="og:title" content="Aporte de ${authorName} | Comunidad EPT">
        <meta property="og:description" content="${postText}">
        <meta property="og:image" content="${imageUrl}">

        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="Aporte de ${authorName} | Comunidad EPT">
        <meta name="twitter:description" content="${postText}">
        <meta name="twitter:image" content="${imageUrl}">

        <script>window.location.replace("${targetUrl}");</script>
    </head>
    <body>
        Redirigiendo a la comunidad Epistecnología...
    </body>
    </html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });

  } catch (error) {
    console.error("Error generando proxy:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: "https://epistecnologia.com/comunidad.html" }
    });
  }
});