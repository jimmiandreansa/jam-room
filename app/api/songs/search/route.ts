import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase-server";
import { DEFAULT_COVER_URL, SEARCH_LIMIT } from "@/lib/songConstants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Math.max(1, Number(searchParams.get("limit") ?? SEARCH_LIMIT)),
    20,
  );

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const supabase = createSupabaseAnonClient();
    const pattern = `%${q}%`;
    const { data, error } = await supabase
      .from("songs")
      .select("id, title, artist, cover_url, duration_seconds")
      .or(`title.ilike.${pattern},artist.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const items = (data ?? []).map((row) => ({
      songId: row.id as string,
      title: row.title as string,
      artist: (row.artist as string | null) ?? null,
      thumbnail: (row.cover_url as string | null) || DEFAULT_COVER_URL,
      duration_seconds: row.duration_seconds as number | null,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[songs/search]", e);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
