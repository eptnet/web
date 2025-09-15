// En: supabase/functions/accept-invitation/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token } = await req.json()
    if (!token) throw new Error("Falta el token de invitación.")

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Usuario no autenticado.")

    // Usamos un cliente con rol de servicio para poder modificar la tabla
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscamos la invitación pendiente con ese token
    const { data: invitation, error: findError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (findError || !invitation) throw new Error("Token de invitación inválido o ya utilizado.")
    
    // Verificamos que el email del nuevo usuario coincida con el email invitado
    if (invitation.invitee_email.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error("Este token de invitación pertenece a otro correo electrónico.")
    }

    // Si todo es correcto, actualizamos el estado de la invitación
    const { error: updateError } = await supabaseAdmin
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true, message: 'Invitación aceptada.' }), {
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