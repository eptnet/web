import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend'

console.log("Función 'report-session' inicializada.");

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)

// --- INICIO: CABECERAS DE CORS ---
// Estas cabeceras le dan permiso a tu web para comunicarse con la función
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // O 'https://epistecnologia.com' para más seguridad
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
// --- FIN: CABECERAS DE CORS ---

Deno.serve(async (req) => {
  // --- INICIO: MANEJO DE LA PETICIÓN PREFLIGHT (CORS) ---
  // Si el navegador envía la petición de "permiso" (OPTIONS), respondemos afirmativamente.
  if (req.method === 'OPTIONS') {
    console.log("Petición OPTIONS recibida para CORS. Respondiendo...");
    return new Response('ok', { headers: corsHeaders })
  }
  // --- FIN: MANEJO DE LA PETICIÓN PREFLIGHT ---

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { sessionId } = await req.json()
    if (!sessionId) throw new Error("Falta el ID de la sesión en la petición.");
    
    console.log(`Datos recibidos. Buscando sesión: ${sessionId}`);

    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('id, session_title, user_id, organizer:profiles(display_name)')
      .eq('id', sessionId)
      .single()

    if (error) throw error

    console.log("Intentando enviar email...");
    await resend.emails.send({
      from: 'alertas@notifications.epistecnologia.com',
      to: 'hmarquez@epistecnologia.com',
      subject: `⚠️ Reporte de Sesión en Epistecnología`,
      html: `
        <h1>Alerta de Contenido Reportado</h1>
        <p>Se ha reportado la sesión: ${session.session_title} (ID: ${session.id})</p>
        <p>Organizador: ${session.organizer.display_name} (ID: ${session.user_id})</p>
      `,
    })
    console.log("Email enviado con éxito.");

    return new Response(JSON.stringify({ message: "Reporte enviado con éxito." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error detallado en la Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})