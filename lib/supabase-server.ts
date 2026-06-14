import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { normalizeSupabaseProjectUrl } from "@/lib/supabase";

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return normalizeSupabaseProjectUrl(url);
}

function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return key.trim();
}

/** Cookie-based Supabase client for Route Handlers and Server Components. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* ignore — called from Server Component without mutable cookies */
        }
      },
    },
  });
}

/** Service-role-free admin client using anon key (for public reads in API routes). */
export function createSupabaseAnonClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseAnonKey());
}

/** Require authenticated user from cookie session or Bearer token. */
export async function requireAuthUser(request?: Request): Promise<{
  user: User;
  supabase: SupabaseClient;
}> {
  const bearer = request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (bearer) {
    const supabase = createClient(supabaseUrl(), supabaseAnonKey(), {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new AuthError("Unauthorized");
    }
    return { user: data.user, supabase };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthError("Unauthorized");
  }
  return { user: data.user, supabase };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
