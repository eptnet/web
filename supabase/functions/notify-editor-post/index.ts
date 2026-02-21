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
    // Supabase Webhooks envían la información dentro de 'record' (nuevo) y 'old_record' (viejo)
    const payload = await req.json()
    const newPost = payload.record
    const oldPost = payload.old_record

    // 1. Verificación de seguridad: Solo continuamos si el estado es 'published'
    if (!newPost || newPost.status !== 'published') {
      return new Response(JSON.stringify({ message: "No es una publicación. Ignorando." }), { status: 200, headers: corsHeaders })
    }

    // 2. Evitar SPAM: Si fue una actualización, pero YA estaba publicado antes, lo ignoramos.
    if (payload.type === 'UPDATE' && oldPost?.status === 'published') {
      return new Response(JSON.stringify({ message: "El post ya estaba publicado antes. Ignorando." }), { status: 200, headers: corsHeaders })
    }

    // 3. Cliente con permisos de Administrador para cruzar datos
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Obtener datos del Autor y del Proyecto para enriquecer el correo
    const { data: author } = await supabaseAdmin.from('profiles').select('display_name, email').eq('id', newPost.user_id).single()
    const { data: project } = await supabaseAdmin.from('projects').select('title, doi').eq('id', newPost.project_id).single()

    const publishDate = new Date(newPost.published_at || newPost.updated_at).toLocaleString('es-PE', {
        timeZone: 'America/Lima', dateStyle: 'full', timeStyle: 'short'
    })

    const subject = `📝 Nuevo Artículo para Revisión: ${newPost.title || 'Sin título'}`
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h1 style="color: #b72a1e;">¡Nueva Publicación en Epistecnología!</h1>
          <p>Un investigador ha publicado un nuevo artículo. Revísalo para su posible inclusión en la revista (Substack).</p>
          
          <div style="background: #f0f2f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 5px;"><strong>👨‍🔬 Autor:</strong> ${author?.display_name || 'Desconocido'} (${author?.email || 'Sin email'})</li>
                <li style="margin-bottom: 5px;"><strong>🔬 Proyecto:</strong> ${project?.title || 'N/A'}</li>
                <li style="margin-bottom: 5px;"><strong>🏷️ DOI del Proyecto:</strong> ${project?.doi || 'Ninguno'}</li>
                <li style="margin-bottom: 5px;"><strong>📅 Fecha de Pub.:</strong> ${publishDate}</li>
              </ul>
          </div>

          <h2 style="border-bottom: 2px solid #b72a1e; padding-bottom: 5px;">${newPost.title || 'Artículo Sin Título'}</h2>
          
          <div style="background: #ffffff; padding: 20px; border: 1px solid #ddd; border-radius: 8px; line-height: 1.6;">
            ${newPost.content}
          </div>
          
          <p style="font-size: 0.85em; color: #777; margin-top: 20px; text-align: center;">
            Este es un correo automático del Hub Omnicanal de Epistecnología.
          </p>
      </div>
    `

    // 5. Enviar usando Resend
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
        throw new Error(`Resend Error: ${JSON.stringify(errorBody)}`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    console.error("Error en notify-editor-post:", error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})