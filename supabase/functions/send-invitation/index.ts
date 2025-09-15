// En: supabase/functions/send-invitation/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const PLATFORM_URL = 'https://epistecnologia.com' // Cambia si tu URL de registro es otra

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Obtenemos el email del invitado y creamos un cliente de Supabase
    const { email: inviteeEmail } = await req.json()
    if (!inviteeEmail) throw new Error("El email del invitado es requerido.")

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Obtenemos el perfil del usuario que está enviando la invitación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("No se pudo identificar al usuario que invita.")
    
    const { data: inviterProfile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    if (profileError) throw new Error("No se pudo encontrar el perfil del invitador.")

    // 3. Generamos un token único y seguro
    const token = crypto.randomUUID()

    // 4. Guardamos la invitación en la base de datos
    const { error: insertError } = await supabase
      .from('invitations')
      .insert({
        inviter_id: user.id,
        invitee_email: inviteeEmail,
        token: token,
        status: 'pending'
      })
    
    if (insertError) {
        // Manejamos el caso en que la invitación ya exista
        if (insertError.code === '23505') { // Código de error para violación de constraint 'unique'
            throw new Error(`Ya existe una invitación pendiente para ${inviteeEmail}.`)
        }
        throw insertError
    }

    // 5. Preparamos y enviamos el correo electrónico con Resend
    const inviterName = inviterProfile.display_name || 'un colega'
    const registrationLink = `${PLATFORM_URL}/?invitation_token=${token}` // Apuntamos a la raíz
    
    const subject = `📧 Invitación para unirte a Epistecnología`
    const emailHtml = `
      <h1>¡Has sido invitado!</h1>
      <p>Hola,</p>
      <p><strong>${inviterName}</strong> te ha invitado a unirte a Epistecnología, una plataforma para la divulgación de conocimiento académico y cultural.</p>
      <p>Para aceptar la invitación y crear tu cuenta, por favor usa el siguiente enlace:</p>
      <a href="${registrationLink}" style="display: inline-block; padding: 12px 24px; background-color: #b72a1e; color: white; text-decoration: none; border-radius: 8px;">Crear mi Cuenta</a>
      <p>¡Esperamos verte pronto!</p>
      <p><em>El equipo de Epistecnología</em></p>
    `

    const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
            from: 'invitaciones@notifications.epistecnologia.com',
            to: inviteeEmail,
            subject: subject,
            html: emailHtml,
        }),
    })

    if (!resendResponse.ok) {
        throw new Error('El servicio de correo (Resend) falló.')
    }

    return new Response(JSON.stringify({ success: true, message: '¡Invitación enviada con éxito!' }), {
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