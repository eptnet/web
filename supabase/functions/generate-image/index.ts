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
    const { prompt, style } = await req.json();
    if (!prompt) throw new Error("No se recibió texto.");

    // Prompts optimizados para el modelo SUPERIOR (FLUX)
    let styleModifier = "";
    if (style === "editorial") styleModifier = "masterpiece, highly detailed, classical art style, professional concept art";
    if (style === "realistic") styleModifier = "ultra photorealistic, 8k resolution, cinematic lighting, sharp focus";
    if (style === "vector") styleModifier = "flat vector illustration, clean lines, solid colors, minimalist, white background";
    if (style === "cinematic") styleModifier = "cinematic shot, dramatic lighting, epic composition, 35mm photography";
    
    const finalPrompt = encodeURIComponent(`${prompt}, ${styleModifier}`);
    const randomSeed = Math.floor(Math.random() * 1000000);

    // 1. VOLVEMOS A FLUX.
    // 2. SIEMPRE pedimos 1024x1024 para que la IA dé su máximo rendimiento sin estirar.
    const imageUrl = `https://image.pollinations.ai/prompt/${finalPrompt}?width=1024&height=1024&model=flux&seed=${randomSeed}&nologo=true`;

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Servicio saturado. Intenta de nuevo.");

    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = encode(new Uint8Array(arrayBuffer)); 

    return new Response(JSON.stringify({ success: true, image: `data:image/jpeg;base64,${base64}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    });
  }
})