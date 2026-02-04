/**
 * Supabase configuration for client-side upserts.
 */
export const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL || ""
export const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY || ""
export const SUPABASE_TWEETS_TABLE = process.env.PLASMO_PUBLIC_SUPABASE_TWEETS_TABLE || "tweets"
