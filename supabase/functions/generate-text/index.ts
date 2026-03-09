import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Leemos la clave secreta
const POLLINATIONS_API_KEY = Deno.env.get("POLLINATIONS_API_KEY") || "";

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
    const { textContent, promptType, customPrompt } = await req.json();
    let prompt = "";

    const baseInstruction = customPrompt ? customPrompt : "Sigue las instrucciones generales.";

    if (promptType === 'suggest_titles') {
      prompt = `Actúa como un editor experto en divulgación científica. Basado en el siguiente artículo, sugiere 5 títulos atractivos y concisos. Devuelve solo una lista numerada, sin introducciones. ${baseInstruction}. Artículo: "${textContent}"`;
    } else if (promptType === 'create_summary') {
      prompt = `Actúa como un comunicador científico. Crea un resumen conciso (máximo 100 palabras) del siguiente texto. ${baseInstruction}. Texto: "${textContent}"`;
    } else if (promptType === 'generate_from_instructions') {
      if (!customPrompt) throw new Error("Para 'generate_from_instructions', se requiere un 'customPrompt'.");
      prompt = `${customPrompt}\n\nEl texto base sobre el que debes trabajar es el siguiente: "${textContent}"`;
    } else {
      throw new Error("Tipo de prompt no válido.");
    }
    
    console.log("Enviando prompt a Pollinations (Modelo: Mistral)...");
    
    // NUEVA URL OFICIAL Y AUTENTICACIÓN BEARER
    const response = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${POLLINATIONS_API_KEY}` // <-- Autenticación requerida
        },
        body: JSON.stringify({
            model: "mistral", // Usamos Mistral según la documentación oficial
            messages: [
                { role: "system", content: "Eres un asistente experto en comunicación científica." },
                { role: "user", content: prompt }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Error en el servidor de IA: ${await response.text()}`);
    }

    const data = await response.json();
    const aiText = data.choices[0].message.content;

    return new Response(JSON.stringify({ result: aiText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error final en la Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})