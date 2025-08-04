Deno.serve(async (req) => {
  console.log("Petición recibida.");
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { sessionId } = await req.json()
    console.log(`Obteniendo datos de la sesión: ${sessionId}`);

    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('id, session_title, user_id, organizer:profiles(display_name)')
      .eq('id', sessionId)
      .single()

    if (error) throw error
    console.log(`Datos de la sesión obtenidos: ${session.session_title}`);

    console.log("Intentando enviar email a hmarquez@epistecnologia.com...");
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'alertas@notifications.epistecnologia.com', // <-- CAMBIO REALIZADO AQUÍ
      to: 'hmarquez@epistecnologia.com',
      subject: `⚠️ Reporte de Sesión en Epistecnología`,
      html: `
        <h1>Alerta de Contenido Reportado</h1>
        <p>Se ha reportado una sesión en la plataforma.</p>
        <ul>
          <li><strong>ID de Sesión:</strong> ${session.id}</li>
          <li><strong>Título:</strong> ${session.session_title}</li>
          <li><strong>Organizador:</strong> ${session.organizer.display_name} (ID: ${session.user_id})</li>
        </ul>
        <p>Por favor, revisa el contenido lo antes posible desde tu panel de control.</p>
      `,
    })
    
    if (emailError) throw emailError;

    console.log("Email enviado con éxito. ID del email:", emailData.id);

    return new Response(JSON.stringify({ message: "Reporte enviado con éxito." }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error detallado en la Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})