// Contenido para: supabase/functions/_shared/supabase-admin-client.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Crea un cliente con permisos de administrador usando la Service Role Key.
// Esto es seguro dentro de las Edge Functions.
export const createAdminClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // <-- La clave de administrador
    { auth: { persistSession: false } }
  )
}