"use client";

import Image from "next/image";
import { useState } from "react";
import type { YoutubeSearchHit } from "@/lib/types";

type RoomRecommendationsProps = {
  recommendations: YoutubeSearchHit[];
  loading?: boolean;
  error?: string | null;
  onAdd: (hit: YoutubeSearchHit) => void | Promise<void>;
  /** Whether host autoplay is active (shown as a hint). */
  autoplayOn?: boolean;
  disabled?: boolean;
};

export function RoomRecommendations({
  recommendations,
  loading,
  error,
  onAdd,
  autoplayOn,
  disabled,
}: RoomRecommendationsProps) {
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleAdd = async (hit: YoutubeSearchHit) => {
    if (addingId || disabled) return;
    setAddingId(hit.videoId);
    try {
      await onAdd(hit);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-jam-muted">
          Rekomendasi
        </h2>
        {autoplayOn ? (
          <span className="shrink-0 text-[11px] text-jam-accent" role="status">
            Autoplay aktif
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-jam-surface/80 p-4 text-sm text-jam-muted">
          Memuat rekomendasi…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-jam-surface/80 p-4 text-sm text-jam-muted">
          Belum ada rekomendasi.
        </div>
      ) : (
        <ul className="space-y-2 rounded-2xl border border-white/10 bg-jam-surface/80 p-2">
          {recommendations.map((hit) => {
            const isAdding = addingId === hit.videoId;
            return (
              <li
                key={hit.videoId}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5"
              >
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black">
                  <Image
                    src={hit.thumbnail}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                  {hit.title}
                </p>
                <button
                  type="button"
                  onClick={() => void handleAdd(hit)}
                  disabled={Boolean(addingId) || disabled}
                  className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-jam-accent transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAdding ? "…" : "+ Antre"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
