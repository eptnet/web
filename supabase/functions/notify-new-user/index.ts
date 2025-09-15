// En: supabase/functions/notify-new-user/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = 'hmarquez@epistecnologia.com'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record: newProfile } = await req.json()
    if (!newProfile) {
      throw new Error("No se recibieron los datos del nuevo perfil.")
    }

    // --- INICIO DE LA LÓGICA MEJORADA ---
    // 1. Creamos un cliente de Supabase con permisos de administrador para poder consultar la tabla auth.users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // ¡Importante! Usa la Service Role Key
    )

    // 2. Usamos el ID del nuevo perfil para buscar al usuario correspondiente en la tabla de autenticación
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(newProfile.id)
    if (authError) {
      throw new Error(`No se pudo encontrar al usuario en auth.users: ${authError.message}`)
    }
    
    // 3. Extraemos la plataforma de registro (Google, GitHub, etc.)
    const provider = authUser.app_metadata.provider || 'Email/Contraseña'
    
    // 4. CORRECCIÓN DEFINITIVA DE LA FECHA
    // Creamos la fecha siendo explícitos con la zona horaria de Perú
    const registrationDate = new Date(authUser.created_at).toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        dateStyle: 'full',
        timeStyle: 'medium',
    })
    // --- FIN DE LA LÓGICA MEJORADA ---

    const subject = `🎉 Nuevo Usuario: ${newProfile.display_name || authUser.email}`
    const emailHtml = `
      <h1>¡Nuevo Registro en Epistecnología!</h1>
      <p>Un nuevo usuario se ha unido a la plataforma.</p>
      <ul>
        <li><strong>Nombre:</strong> ${newProfile.display_name || 'No especificado'}</li>
        <li><strong>Email:</strong> ${authUser.email}</li>
        <li><strong>Plataforma de Registro:</strong> ${provider}</li>
        <li><strong>Fecha de Registro:</strong> ${registrationDate}</li>
        <li><strong>ID de Usuario:</strong> ${newProfile.id}</li>
      </ul>
      <p>Puedes ver su perfil en el <a href="https://epistecnologia.com/inv/profile.html?id=${newProfile.id}">Directorio</a>.</p>
    `

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'alertas@notifications.epistecnologia.com',
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
    console.error("Error en la función notify-new-user:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})