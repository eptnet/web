import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    const customInstructions = customPrompt ? `Instrucciones adicionales del autor: "${customPrompt}"` : "Sigue las instrucciones generales.";

    if (promptType === 'suggest_titles') {
      prompt = `Actúa como un editor experto en divulgación científica. Basado en el siguiente artículo, sugiere 5 títulos atractivos y concisos. ${customInstructions}. Devuelve solo una lista numerada, sin introducciones. Artículo: "${textContent}"`;
    } else if (promptType === 'create_summary') {
      prompt = `Actúa como un comunicador científico. Crea un resumen conciso (máximo 100 palabras) del siguiente texto. ${customInstructions}. Texto: "${textContent}"`;
    } else {
      throw new Error("Tipo de prompt no válido.");
    }
    
    console.log("Enviando prompt a Gemini...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    
    // --- INICIO: VERIFICACIÓN DE LA RESPUESTA DE LA IA ---
    console.log("Respuesta completa de Gemini recibida:", JSON.stringify(response, null, 2));

    // Verificamos si la IA bloqueó la respuesta por seguridad u otra razón
    if (response.promptFeedback?.blockReason) {
        throw new Error(`La IA bloqueó la solicitud. Razón: ${response.promptFeedback.blockReason}`);
    }
    if (!response.text) {
         throw new Error(`La IA no devolvió texto. Razón de finalización: ${response.finishReason}`);
    }
    // --- FIN: VERIFICACIÓN DE LA RESPUESTA DE LA IA ---
    
    const aiText = response.text();

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