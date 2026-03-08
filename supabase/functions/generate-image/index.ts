import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { prompt, style, ratio } = await req.json();

    if (!prompt) throw new Error("No se recibió ningún texto para generar la imagen.");

    // 1. Prompts optimizados para el modelo FLUX
    let styleModifier = "";
    if (style === "editorial") styleModifier = "masterpiece, oil painting style, highly detailed, classical art, museum quality";
    if (style === "realistic") styleModifier = "photorealistic, 8k, highly detailed photography, cinematic lighting, sharp focus";
    if (style === "vector") styleModifier = "flat vector art, clean lines, minimalist infographic style, solid colors, 2d illustration";
    if (style === "cinematic") styleModifier = "cinematic shot, dramatic lighting, movie still, 35mm lens, atmospheric";
    
    // 2. Control de Proporciones exactas (Añadido 1:1)
    let width = 1024;
    let height = 1024;
    
    if (ratio === "16:9") { 
        width = 1024; 
        height = 576; 
    } else if (ratio === "9:16") { 
        width = 576; 
        height = 1024; 
    } else if (ratio === "1:1") { 
        width = 1024; 
        height = 1024; 
    }

    // Unimos el texto y lo preparamos para la URL
    const finalPrompt = encodeURIComponent(`${prompt}, ${styleModifier}`);

    // 3. LLAMADA A LA API (Fijamos model=flux para evitar imágenes estiradas)
    const imageUrl = `https://image.pollinations.ai/prompt/${finalPrompt}?width=${width}&height=${height}&model=flux&nologo=true`;

    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error("El servicio de generación de imágenes gratuito está saturado. Intenta de nuevo.");
    }

    // Transformamos la imagen a Base64
    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = encode(new Uint8Array(arrayBuffer)); 

    return new Response(JSON.stringify({ success: true, image: `data:image/jpeg;base64,${base64}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
    });
  }
})