import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Supabase client using the service role key. Bypasses RLS entirely.
// Only use in server-side admin API routes that have already validated
// the admin secret via adminAuth.ts.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role config");
  return createSupabaseClient(url, key);
}
