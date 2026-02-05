/**
 * Supabase client helper.
 *
 * Currently uses the anon key directly (no Clerk auth).
 * TODO: Re-enable Clerk JWT auth once the extension's auth flow covers Twitter tabs.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  console.warn("[Supabase] PLASMO_PUBLIC_SUPABASE_URL not set")
}
if (!SUPABASE_ANON_KEY) {
  console.warn("[Supabase] PLASMO_PUBLIC_SUPABASE_ANON_KEY not set")
}

let supabaseClient: SupabaseClient | null = null

/**
 * Get or create a Supabase client using the anon key.
 *
 * No Clerk JWT auth for now — RLS policies should either be disabled
 * on the tweets table or allow anon inserts while auth is being set up.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient

  supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  return supabaseClient
}
