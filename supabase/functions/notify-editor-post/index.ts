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
    console.log("¡Ding dong! El Webhook ha tocado la puerta.");
    const payload = await req.json()
    const newPost = payload.record
    const oldPost = payload.old_record

    if (!newPost || newPost.status !== 'published') {
      return new Response(JSON.stringify({ message: "No es una publicación. Ignorando." }), { status: 200, headers: corsHeaders })
    }

    if (payload.type === 'UPDATE' && oldPost?.status === 'published') {
      return new Response(JSON.stringify({ message: "El post ya estaba publicado antes. Ignorando." }), { status: 200, headers: corsHeaders })
    }

    if (newPost.send_email === false) {
      return new Response(JSON.stringify({ message: "Publicación exclusiva para RRSS. Se omite el correo automático." }), { status: 200, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: author } = await supabaseAdmin.from('profiles').select('display_name, email').eq('id', newPost.user_id).single()
    const { data: project } = await supabaseAdmin.from('projects').select('title, doi').eq('id', newPost.project_id).single()

    const publishDate = new Date(newPost.published_at || newPost.updated_at).toLocaleString('es-PE', {
        timeZone: 'America/Lima', dateStyle: 'full', timeStyle: 'short'
    })

    // --- EL TRADUCTOR INVISIBLE (De JSON a HTML hermoso) ---
    let articleHtml = "";
    if (newPost.content && newPost.content.blocks) {
        newPost.content.blocks.forEach((block: any) => {
            switch (block.type) {
                case 'paragraph':
                    articleHtml += `<p style="margin-bottom: 1.2em; font-size: 16px; line-height: 1.6;">${block.data.text}</p>`;
                    break;
                case 'header':
                    articleHtml += `<h${block.data.level} style="color: #b72a1e; margin-top: 1.5em; margin-bottom: 0.5em;">${block.data.text}</h${block.data.level}>`;
                    break;
                case 'list':
                    const listTag = block.data.style === 'ordered' ? 'ol' : 'ul';
                    const listItems = block.data.items.map((item: string) => `<li style="margin-bottom: 0.5em;">${item}</li>`).join('');
                    articleHtml += `<${listTag} style="margin-bottom: 1.2em; padding-left: 20px; font-size: 16px;">${listItems}</${listTag}>`;
                    break;
                case 'image':
                    articleHtml += `<div style="text-align: center; margin: 2em 0;">
                        <img src="${block.data.file.url}" style="max-width: 100%; border-radius: 8px;" alt="Imagen del artículo">
                        ${block.data.caption ? `<p style="font-size: 0.85em; color: #666; margin-top: 8px;">${block.data.caption}</p>` : ''}
                    </div>`;
                    break;
                default:
                    console.log("Bloque no soportado ignorado:", block.type);
            }
        });
    } else {
        articleHtml = "<p>El artículo no contiene texto o el formato es incorrecto.</p>";
    }

    const subject = `📝 Nuevo Artículo para Revisión: ${newPost.title || 'Sin título'}`
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #333;">
          <h1 style="color: #b72a1e;">¡Nueva Publicación en Epistecnología!</h1>
          <p>Un investigador ha publicado un nuevo artículo. Puedes copiar el texto de abajo y pegarlo directamente en Substack.</p>
          
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
                <li style="margin-bottom: 8px;"><strong>👨‍🔬 Autor:</strong> ${author?.display_name || 'Desconocido'} (${author?.email || 'Sin email'})</li>
                <li style="margin-bottom: 8px;"><strong>🔬 Proyecto:</strong> ${project?.title || 'N/A'}</li>
                <li style="margin-bottom: 8px;"><strong>🏷️ DOI del Proyecto:</strong> ${project?.doi || 'Ninguno'}</li>
                <li style="margin-bottom: 8px;"><strong>📅 Fecha de Pub.:</strong> ${publishDate}</li>
              </ul>
          </div>

          <hr style="border: none; border-top: 2px solid #b72a1e; margin-bottom: 20px;">
          <h1 style="font-size: 28px; margin-bottom: 20px;">${newPost.title || 'Artículo Sin Título'}</h1>
          
          <div style="background: #ffffff; padding: 0; line-height: 1.6;">
            ${articleHtml}
          </div>
          
          <p style="font-size: 0.85em; color: #94a3b8; margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Este es un correo automático del Hub Omnicanal de Epistecnología.
          </p>
      </div>
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
        throw new Error(`Resend Error: ${JSON.stringify(errorBody)}`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    console.error("Error en notify-editor-post:", error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})