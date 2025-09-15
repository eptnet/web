// En: supabase/functions/notify-new-user/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Asegúrate de tener tu API Key de Resend en los secretos de Supabase:
// supabase secrets set RESEND_API_KEY=tu_api_key_de_resend
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = 'hmarquez@epistecnologia.com' // Tu email de administrador

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record: newUser } = await req.json()
    if (!newUser) {
      throw new Error("No se recibieron los datos del nuevo usuario.")
    }

    const subject = `🎉 Nuevo Usuario Registrado en Epistecnología`
    const emailHtml = `
      <h1>¡Nuevo Registro!</h1>
      <p>Un nuevo usuario se ha unido a la plataforma Epistecnología.</p>
      <ul>
        <li><strong>ID:</strong> ${newUser.id}</li>
        <li><strong>Nombre:</strong> ${newUser.display_name || 'No especificado'}</li>
        <li><strong>Email:</strong> ${newUser.email || 'No disponible'}</li>
        <li><strong>Fecha de Registro:</strong> ${new Date(newUser.created_at).toLocaleString('es-PE')}</li>
      </ul>
      <p>Puedes ver su perfil en el dashboard de administradores.</p>
    `

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'plataforma@epistecnologia.com', // Debe ser un dominio verificado en Resend
        to: ADMIN_EMAIL,
        subject: subject,
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
        const errorBody = await resendResponse.json();
        console.error('Error de Resend:', errorBody);
        throw new Error('El servicio de correo (Resend) falló al enviar la notificación.');
    }

    return new Response(JSON.stringify({ success: true, message: 'Notificación enviada.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})