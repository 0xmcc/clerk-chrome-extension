/**
 * Supabase client helper with Clerk JWT authentication.
 *
 * Creates a Supabase client that injects the Clerk session token
 * as an Authorization bearer header on every request.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requestClerkToken } from "~utils/clerk"

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
 * Get or create a Supabase client that authenticates with Clerk JWTs.
 *
 * The client uses a custom fetch wrapper that obtains a fresh Clerk token
 * for each request and sets it as the Authorization bearer header.
 * This allows Supabase RLS policies to use `auth.jwt()->>'sub'` for
 * user-scoped access control.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient

  supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        let token: string | null = null
        try {
          token = await requestClerkToken()
        } catch (err) {
          console.error("[Supabase] Failed to get Clerk token:", err)
        }

        const headers = new Headers(init?.headers)
        if (token) {
          headers.set("Authorization", `Bearer ${token}`)
        }

        return fetch(input, {
          ...init,
          headers
        })
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  return supabaseClient
}
