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
    const { prompt, style, ratio, engine = 'flux' } = await req.json();
    if (!prompt) throw new Error("No se recibió texto.");

    // PROMPTS MAESTROS NIVEL EXPERTO (Evitando deformaciones y exigiendo calidad top)
    let styleModifier = "";
    if (style === "editorial") styleModifier = "award-winning professional editorial illustration, pristine composition, flawless proportions, high-end commercial art, masterpiece, visually stunning, no deformations";
    if (style === "realistic") styleModifier = "ultra-realistic 8k photography, shot on 35mm lens, perfect anatomy, sharp focus, National Geographic standard, highly detailed, photorealistic, no anatomical anomalies";
    if (style === "vector") styleModifier = "premium vector graphics, clean SVG style, flat colors, perfect geometry, professional corporate illustration, minimalist, white background, UI asset";
    if (style === "cinematic") styleModifier = "Hollywood cinematic lighting, epic establishing shot, rule of thirds, photorealistic, majestic composition, 8k resolution, flawless perspective";
    
    // TAMAÑOS UNIVERSALES: Confiamos en que la API respete la medida enviada
    let width = 1024, height = 1024;
    if (ratio === "16:9") { width = 1024; height = 576; }
    else if (ratio === "9:16") { width = 576; height = 1024; }
    else if (ratio === "1:1") { width = 1024; height = 1024; }

    const finalPrompt = encodeURIComponent(`${prompt}, ${styleModifier}`);
    const randomSeed = Math.floor(Math.random() * 1000000);

    // URL Limpia y directa
    const imageUrl = `https://image.pollinations.ai/prompt/${finalPrompt}?width=${width}&height=${height}&model=${engine}&seed=${randomSeed}&nologo=true`;

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