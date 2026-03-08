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

    // 1. Prompts ultra-optimizados para el modelo SDXL (Más realistas, menos abstractos)
    let styleModifier = "";
    if (style === "editorial") styleModifier = "professional editorial illustration, highly detailed, classical art style, masterpiece";
    if (style === "realistic") styleModifier = "photorealistic, 8k resolution, scientific photography, sharp focus, realistic textures";
    if (style === "vector") styleModifier = "flat vector illustration, 2d, clean lines, solid colors, minimalist educational infographic, white background";
    if (style === "cinematic") styleModifier = "cinematic lighting, movie still, dramatic shadows, epic composition, hyperrealistic 35mm photograph";
    
    // 2. Dimensiones nativas para SDXL (El modelo se adapta al lienzo sin estirar)
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

    const finalPrompt = encodeURIComponent(`${prompt}, ${styleModifier}`);

    // 3. CAMBIO DE MOTOR: model=turbo (SDXL). Adiós a las imágenes estiradas.
    const imageUrl = `https://image.pollinations.ai/prompt/${finalPrompt}?width=${width}&height=${height}&model=turbo&nologo=true`;

    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error("El servicio de generación de imágenes gratuito está saturado. Intenta de nuevo.");
    }

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