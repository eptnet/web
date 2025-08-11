// Contenido para: supabase/functions/_shared/supabase-client.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Esta función crea un cliente de Supabase que utiliza el token de autenticación
// del usuario que llama a la Edge Function.
export const createSupabaseClient = (authHeader: string) => {
  return createClient(
    // Obtiene las variables de entorno de tu proyecto de Supabase
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  )
}