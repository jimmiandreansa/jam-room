"use client";

import Image from "next/image";
import { useState } from "react";
import type { YoutubeSearchHit } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type SearchPanelProps = {
  onPick: (hit: YoutubeSearchHit) => Promise<void>;
  disabled?: boolean;
};

export function SearchPanel({ onPick, disabled }: SearchPanelProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<YoutubeSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  async function search() {
    setError(null);
    setResults([]);
    const trimmed = q.trim();
    if (!trimmed) {
      setError("Enter a search term.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(trimmed)}`,
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? "Search failed.");
        return;
      }
      setResults(body.items ?? []);
      if (!body.items?.length) {
        setError("No results.");
      }
    } catch {
      setError("Network error while searching.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-jam-surface/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-jam-muted">
        Add from YouTube
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Search"
            name="yt-search"
            placeholder="Artist or song title"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
            disabled={disabled || loading}
          />
        </div>
        <Button
          type="button"
          onClick={() => void search()}
          disabled={disabled || loading}
          className="shrink-0 sm:mb-0.5"
        >
          {loading ? "Searching…" : "Search"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-1">
          {results.map((hit) => (
            <li key={hit.videoId}>
              <button
                type="button"
                disabled={disabled || addingId === hit.videoId}
                onClick={async () => {
                  setAddingId(hit.videoId);
                  try {
                    await onPick(hit);
                  } finally {
                    setAddingId(null);
                  }
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2 text-left transition hover:border-jam-accent/50 hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
              >
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-black">
                  <Image
                    src={hit.thumbnail}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="96px"
                    unoptimized
                  />
                </div>
                <span className="line-clamp-2 flex-1 text-sm text-white">
                  {hit.title}
                </span>
                <span className="pr-2 text-xs text-jam-muted">
                  {addingId === hit.videoId ? "Adding…" : "Add"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
