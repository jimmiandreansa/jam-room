"use client";

import { useMemo } from "react";

/** True when public Supabase env vars are present (client-side check). */
export function useSupabaseConfigured() {
  return useMemo(() => {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }, []);
}
