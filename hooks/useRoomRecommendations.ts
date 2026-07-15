"use client";

import { useEffect, useMemo, useState } from "react";
import type { YoutubeSearchHit } from "@/lib/types";

type UseRoomRecommendationsArgs = {
  /** Current video id — seed for the real YouTube related feed. */
  currentVideoId: string | null;
  /** Video ids to hide from the panel (current + played + queued). */
  excludeIds: string[];
  enabled: boolean;
};

/**
 * Fetches real YouTube "up next"/related recommendations once per track change
 * (keyed by videoId) and filters out excluded ids client-side without refetching.
 */
export function useRoomRecommendations({
  currentVideoId,
  excludeIds,
  enabled,
}: UseRoomRecommendationsArgs) {
  const [raw, setRaw] = useState<YoutubeSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRaw([]);
      setError(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    const params = new URLSearchParams();
    if (currentVideoId) params.set("videoId", currentVideoId);
    params.set("limit", "15");

    setLoading(true);
    setError(null);

    fetch(`/api/youtube/recommendations?${params.toString()}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          items?: YoutubeSearchHit[];
          error?: string;
        };
        if (!res.ok) throw new Error(body?.error ?? "Gagal memuat rekomendasi.");
        return body.items ?? [];
      })
      .then((items) => {
        if (!ac.signal.aborted) setRaw(items);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRaw([]);
        setError(e instanceof Error ? e.message : "Gagal memuat rekomendasi.");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
    // Only refetch when the track changes — not when excludeIds change.
  }, [enabled, currentVideoId]);

  const excludeKey = excludeIds.join(",");
  const recommendations = useMemo(() => {
    const ex = new Set(excludeKey ? excludeKey.split(",") : []);
    return raw.filter((h) => !ex.has(h.videoId));
  }, [raw, excludeKey]);

  return { recommendations, loading, error } as const;
}
