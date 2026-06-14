import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase-server";
import { createPresignedGetUrl } from "@/lib/r2";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/songConstants";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseAnonClient();

    const { data: song, error } = await supabase
      .from("songs")
      .select("file_key, cover_key, cover_url")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!song?.file_key) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }

    const url = await createPresignedGetUrl(song.file_key as string);
    let coverUrl: string | null = (song.cover_url as string | null) ?? null;
    if (song.cover_key) {
      try {
        coverUrl = await createPresignedGetUrl(song.cover_key as string);
      } catch {
        /* use stored cover_url */
      }
    }

    const expiresAt = new Date(
      Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString();

    return NextResponse.json({ url, coverUrl, expiresAt });
  } catch (e) {
    console.error("[songs/stream]", e);
    return NextResponse.json({ error: "Failed to get stream URL." }, { status: 500 });
  }
}
