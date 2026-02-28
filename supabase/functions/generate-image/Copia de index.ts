import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const HF_TOKEN = Deno.env.get("HUGGINGFACE_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { prompt, style, ratio } = await req.json();

    // 1. Inyección de Estilo (Tu Iluminista Visual)
    let styleModifier = "";
    if (style === "editorial") styleModifier = "oil painting masterpiece, museum quality, visible brushstrokes, canvas texture, classical art style (Baroque/Neoclassicism/Romanticism), emotional lighting, chiaroscuro, no digital generic look, highly artistic";
    if (style === "realistic") styleModifier = "photorealistic, highly detailed, 8k resolution, scientific photography, macro lens";
    if (style === "vector") styleModifier = "clean vector infographic style, flat colors, sharp edges, 2d educational illustration";
    if (style === "cinematic") styleModifier = "cinematic lighting, movie still, dramatic shadows, epic composition, 35mm lens";
    
    // 2. Control de Proporciones (Aspect Ratio)
    let width = 1024, height = 1024;
    let ratioPrompt = "";
    if (ratio === "16:9") { width = 1024; height = 576; ratioPrompt = "wide angle, horizontal format"; }
    if (ratio === "9:16") { width = 576; height = 1024; ratioPrompt = "vertical portrait format"; }

    const finalPrompt = `${prompt}, ${styleModifier}, ${ratioPrompt}`;

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
      {
        headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ 
            inputs: finalPrompt,
            parameters: { width: width, height: height } // Le pedimos a la IA el tamaño exacto
        }),
      }
    );

    if (!response.ok) throw new Error(await response.text());

    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = encode(new Uint8Array(arrayBuffer)); 

    return new Response(JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})