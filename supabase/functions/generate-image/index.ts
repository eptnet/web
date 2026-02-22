import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const HF_TOKEN = Deno.env.get("HUGGINGFACE_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, style } = await req.json();

    // Enriquecemos el prompt según el estilo elegido en el editor
    let styleModifier = "";
    if (style === "realistic") styleModifier = "photorealistic, highly detailed, 8k resolution, scientific photography, masterpiece";
    if (style === "infographic") styleModifier = "clean vector infographic style, flat colors, educational illustration, white background";
    if (style === "minimalist") styleModifier = "minimalist abstract, clean background, simple shapes, scientific concept";
    
    const finalPrompt = `${prompt}, ${styleModifier}`;

    console.log("Enviando petición a Hugging Face...");
    
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        headers: { 
            Authorization: `Bearer ${HF_TOKEN}`, 
            "Content-Type": "application/json" 
        },
        method: "POST",
        body: JSON.stringify({ inputs: finalPrompt }),
      }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de Hugging Face: ${errorText}`);
    }

    // Convertimos la imagen recibida a Base64 para enviarla al navegador
    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const imageBase64 = `data:image/jpeg;base64,${base64}`;

    return new Response(JSON.stringify({ image: imageBase64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error en Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})