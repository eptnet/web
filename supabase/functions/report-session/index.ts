import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-id', // Añadimos nuestra nueva cabecera
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- INICIO: CAMBIO DE LÓGICA ---
    // Leemos el ID desde las cabeceras en lugar del body
    const sessionId = req.headers.get('x-session-id');
    if (!sessionId) throw new Error("Falta la cabecera 'x-session-id' en la petición.")
    console.log(`ID de sesión recibido desde la cabecera: ${sessionId}`);
    // --- FIN: CAMBIO DE LÓGICA ---

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: session, error: sessionError } = await supabaseClient
      .from('sessions')
      .select('id, session_title, user_id, organizer:profiles(display_name)')
      .eq('id', sessionId)
      .single()

    if (sessionError) throw sessionError

    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)
    await resend.emails.send({
      from: 'alertas@notifications.epistecnologia.com',
      to: 'hmarquez@epistecnologia.com',
      subject: `⚠️ Reporte de Sesión en Epistecnología`,
      html: `
        <h1>Alerta de Contenido Reportado</h1>
        <p>Se ha reportado la sesión: <strong>${session.session_title}</strong> (ID: ${session.id})</p>
        <p>Organizador: ${session.organizer.display_name} (ID: ${session.user_id})</p>
      `,
    })

    return new Response(JSON.stringify({ message: "Reporte enviado con éxito." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Error final en la Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    });
  }
})