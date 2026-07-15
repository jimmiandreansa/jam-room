import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Innertube } from "youtubei.js";
import type { YoutubeSearchHit } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Related feed per video is stable enough to cache in-memory for a while. */
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const relatedCache = new Map<string, { items: YoutubeSearchHit[]; ts: number }>();
let innertubePromise: Promise<Innertube> | null = null;

function getInnertube(): Promise<Innertube> {
  if (!innertubePromise) {
    // No player needed — we only read metadata from the "watch next" feed.
    innertubePromise = Innertube.create({ retrieve_player: false });
  }
  return innertubePromise;
}

/** Permissive shape covering CompactVideo and the newer LockupView nodes. */
type FeedNode = {
  type?: string;
  video_id?: string;
  id?: string;
  content_id?: string;
  content_type?: string;
  title?: { text?: string } | string;
  metadata?: { title?: { text?: string } } | null;
};

function extractHit(node: FeedNode): YoutubeSearchHit | null {
  let id: string | undefined;
  let title: string | undefined;

  if (node.type === "LockupView") {
    if (node.content_type && node.content_type !== "VIDEO") return null;
    id = node.content_id;
    title = node.metadata?.title?.text;
  } else {
    id = node.video_id ?? node.id ?? node.content_id;
    title = typeof node.title === "string" ? node.title : node.title?.text;
  }

  if (!id || !VIDEO_ID_RE.test(id)) return null;
  if (!title) return null;

  return {
    videoId: id,
    title,
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  };
}

/** Real YouTube "watch next"/related feed for a video via InnerTube. */
async function getRelated(videoId: string): Promise<YoutubeSearchHit[]> {
  const cached = relatedCache.get(videoId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.items;

  try {
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);
    const nodes = (info.watch_next_feed ?? []) as unknown as FeedNode[];

    const items: YoutubeSearchHit[] = [];
    const seen = new Set<string>();
    for (const node of nodes) {
      const hit = extractHit(node);
      if (!hit || seen.has(hit.videoId)) continue;
      seen.add(hit.videoId);
      items.push(hit);
    }

    relatedCache.set(videoId, { items, ts: Date.now() });
    return items;
  } catch (e) {
    console.error("[youtube/recommendations] innertube", e);
    return [];
  }
}

/** Fallback: trending music (Data API videos.list, ~1 quota unit). */
async function getTrending(): Promise<YoutubeSearchHit[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("chart", "mostPopular");
    url.searchParams.set("videoCategoryId", "10"); // Music
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("key", key);

    const res = await fetch(url.toString());
    const json = (await res.json()) as {
      items?: {
        id?: string;
        snippet?: {
          title?: string;
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        };
      }[];
    };
    if (!res.ok) return [];

    return (json.items ?? [])
      .map((item) => {
        const videoId = item.id;
        const title = item.snippet?.title;
        const thumbnail =
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url;
        if (!videoId || !title || !thumbnail) return null;
        return { videoId, title, thumbnail };
      })
      .filter(Boolean) as YoutubeSearchHit[];
  } catch (e) {
    console.error("[youtube/recommendations] trending", e);
    return [];
  }
}

/**
 * "Up next" recommendations. Primary source is the real YouTube related feed
 * (InnerTube) for the currently playing `videoId`; falls back to trending music
 * when there is no seed or InnerTube is unavailable.
 */
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId")?.trim() ?? "";
  const excludeParam = req.nextUrl.searchParams.get("exclude") ?? "";
  const exclude = new Set(
    excludeParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Math.min(
    20,
    Math.max(1, Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 12),
  );

  const isBlocked = (h: YoutubeSearchHit) =>
    h.videoId === videoId || exclude.has(h.videoId);

  let items: YoutubeSearchHit[] = [];
  if (videoId && VIDEO_ID_RE.test(videoId)) {
    items = (await getRelated(videoId)).filter((h) => !isBlocked(h));
  }

  // If InnerTube failed/returned too little, blend in trending music.
  if (items.length < 3) {
    const trending = (await getTrending()).filter((h) => !isBlocked(h));
    const seen = new Set(items.map((h) => h.videoId));
    for (const h of trending) {
      if (seen.has(h.videoId)) continue;
      seen.add(h.videoId);
      items.push(h);
    }
  }

  return NextResponse.json({ items: items.slice(0, limit) });
}
