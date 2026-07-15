import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { YoutubeSearchHit } from "@/lib/types";

type YoutubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
};

/**
 * Proxies YouTube Data API search so the API key stays server-side (Vercel-safe).
 */
export async function GET(req: NextRequest) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY on the server." },
      { status: 500 },
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Query ?q= is required." }, { status: 400 });
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const maxResults = Math.min(
    15,
    Math.max(1, Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 5),
  );

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("q", q);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const json = (await res.json()) as {
    items?: YoutubeSearchItem[];
    error?: { message?: string };
  };

  if (!res.ok) {
    return NextResponse.json(
      { error: json.error?.message ?? "YouTube API error" },
      { status: 502 },
    );
  }

  const items: YoutubeSearchHit[] = (json.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title;
      const thumbnail =
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url;
      if (!videoId || !title || !thumbnail) return null;
      return { videoId, title, thumbnail };
    })
    .filter(Boolean) as YoutubeSearchHit[];

  return NextResponse.json({ items });
}
