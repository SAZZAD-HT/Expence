import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser client — uses NEXT_PUBLIC_ keys, safe for use in client components.
 * Only has access to rows permitted by Row Level Security (anon key).
 */
export function createBrowserClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Server client — uses the service-role key, bypasses RLS.
 * Must only be called from Next.js API routes / server-side code.
 * Session persistence and token auto-refresh are disabled intentionally
 * because the service role does not represent a user session.
 */
export function createServerClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
