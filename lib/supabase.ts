import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Project URL only (e.g. https://abcd.supabase.co). If `.env` mistakenly
 * includes `/rest/v1`, PostgREST returns PGRST125 "Invalid path specified in
 * request URL" because the client appends `/rest/v1` again.
 */
export function normalizeSupabaseProjectUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  u = u.replace(/\/rest\/v1\/?$/i, "");
  return u.replace(/\/+$/, "");
}

/**
 * Browser-safe Supabase client. Requires public env vars (safe for Vercel).
 * Throws at call sites if misconfigured so UI can show a clear error.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  const url = normalizeSupabaseProjectUrl(supabaseUrl);
  return createClient(url, supabaseAnonKey.trim());
}

/** Singleton for client components to avoid recreating clients on each render. */
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient();
  }
  return browserClient;
}
