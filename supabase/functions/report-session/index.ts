import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-id, x-reporter-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const sessionId = req.headers.get('x-session-id');
    const reporterId = req.headers.get('x-reporter-id');
    if (!sessionId) throw new Error("Falta la cabecera 'x-session-id'.")

    // 1. Buscamos la sesión reportada (esto es obligatorio)
    const { data: session, error: sessionError } = await supabaseClient
      .from('sessions')
      .select('id, session_title, organizer:profiles(id, display_name)')
      .eq('id', sessionId)
      .single()
    if (sessionError) throw sessionError

    // --- INICIO DE LA LÓGICA CORREGIDA ---
    let reporterName = 'Un invitado anónimo';

    // 2. SOLO si el reporterId NO es el de invitado, buscamos su perfil
    if (reporterId && reporterId !== 'invitado_anónimo') {
      const { data: reporter } = await supabaseClient
        .from('profiles')
        .select('display_name')
        .eq('id', reporterId)
        .single();
      
      // Si encontramos el perfil, usamos su nombre
      if (reporter) {
        reporterName = reporter.display_name;
      }
    }
    // --- FIN DE LA LÓGICA CORREGIDA ---

    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)
    await resend.emails.send({
      from: 'alertas@notifications.epistecnologia.com',
      to: 'hmarquez@epistecnologia.com',
      subject: `⚠️ Reporte de Sesión en Epistecnología`,
      html: `
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 8px;">
            <h1 style="color: #b72a1e;">Alerta de Contenido Reportado</h1>
            <p>Se ha recibido un reporte para una sesión en la plataforma.</p>
            <hr style="border: 0; border-top: 1px solid #eeeeee;">
            <h3>Detalles de la Sesión</h3>
            <ul>
              <li><strong>Título:</strong> ${session.session_title}</li>
              <li><strong>ID de Sesión:</strong> ${session.id}</li>
              <li><strong>Organizador:</strong> ${session.organizer.display_name} (ID: ${session.organizer.id})</li>
            </ul>
            <h3>Detalles del Reporte</h3>
            <ul>
                <li><strong>Reportado por:</strong> ${reporterName} (ID: ${reporterId})</li>
                <li><strong>Fecha del Reporte:</strong> ${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'long' })}</li>
            </ul>
            <hr style="border: 0; border-top: 1px solid #eeeeee;">
            <h3>Acciones Rápidas</h3>
            <p>
              <a href="https://epistecnologia.com/live.html?sesion=${session.id}" style="padding: 10px 15px; background-color: #1877f2; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">Ver Sesión</a>
              <a href="https://epistecnologia.com/inv/profile.html?id=${session.organizer.id}" style="padding: 10px 15px; background-color: #65676b; color: white; text-decoration: none; border-radius: 5px;">Ver Perfil del Organizador</a>
            </p>
          </div>
        </body>
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