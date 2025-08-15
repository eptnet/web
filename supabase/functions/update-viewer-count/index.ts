// Contenido para: /supabase/functions/update-viewer-count/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Manejo de la solicitud OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Obtenemos los datos enviados desde live.js
    const { sessionId, viewerCount } = await req.json()
    if (!sessionId || viewerCount === undefined) {
      throw new Error('Faltan sessionId o viewerCount.')
    }

    // Creamos un cliente de Supabase con permisos de administrador para poder escribir en la tabla
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Obtenemos el valor actual de peak_viewers de la base de datos
    const { data: currentSession, error: fetchError } = await supabaseAdmin
      .from('sessions')
      .select('peak_viewers')
      .eq('id', sessionId)
      .single()

    if (fetchError) throw fetchError

    // 2. Calculamos el nuevo pico de espectadores
    const newPeakViewers = Math.max(currentSession.peak_viewers || 0, viewerCount)

    // 3. Actualizamos la base de datos con los nuevos valores
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({ 
        live_viewers: viewerCount,
        peak_viewers: newPeakViewers 
      })
      .eq('id', sessionId)

    if (updateError) throw updateError

    // Devolvemos una respuesta exitosa
    return new Response(JSON.stringify({ success: true }), {
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