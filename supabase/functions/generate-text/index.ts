import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.24.1"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ¡ACTUALIZACIÓN CRÍTICA! Usamos el modelo más reciente: Gemini 2.5 Flash
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
    
    console.log("Enviando prompt a Gemini 2.5 Flash...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    
    if (response.promptFeedback?.blockReason) {
        throw new Error(`La IA bloqueó la solicitud. Razón: ${response.promptFeedback.blockReason}`);
    }
    const aiText = response.text ? response.text() : `La IA no devolvió texto. Razón: ${response.finishReason}`;

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