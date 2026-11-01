/**
 * Supabase client helper.
 *
 * Currently uses the anon key directly (no Clerk auth). The anon key is public
 * and shared with other apps on this project, so the tweets table's access
 * rules also require a private token, sent as the x-tweets-token header.
 * TODO: Re-enable Clerk JWT auth once the extension's auth flow covers Twitter tabs.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY
const TWEETS_TOKEN = process.env.PLASMO_PUBLIC_TWEETS_TOKEN

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
 * No Clerk JWT auth for now — see supabase/migrations/002_lock_tweets.sql for
 * the RLS policy that checks the token instead.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient

  supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: TWEETS_TOKEN ? { "x-tweets-token": TWEETS_TOKEN } : {}
    }
  })

  return supabaseClient
}
