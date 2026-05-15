"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { YoutubeSearchHit } from "@/lib/types";

const DEBOUNCE_MS = 350;
const MIN_CHARS = 2;
const SEARCH_LIMIT = 10;

type RoomYouTubeSearchProps = {
  onPick: (hit: YoutubeSearchHit) => Promise<void>;
  disabled?: boolean;
};

export function RoomYouTubeSearch({ onPick, disabled }: RoomYouTubeSearchProps) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebounced(q.trim());
      debounceTimerRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [q]);

  const [results, setResults] = useState<YoutubeSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounced.length < MIN_CHARS) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setResults([]);
    setOpen(true);

    const url = `/api/youtube/search?q=${encodeURIComponent(debounced)}&limit=${SEARCH_LIMIT}`;
    fetch(url, { signal: ac.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          items?: YoutubeSearchHit[];
          error?: string;
        };
        if (!res.ok) throw new Error(body?.error ?? "Gagal mencari.");
        return body.items ?? [];
      })
      .then((items) => {
        if (ac.signal.aborted) return;
        setResults(items);
        if (!items.length) setError("Tidak ada hasil.");
        else setError(null);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResults([]);
        setError(e instanceof Error ? e.message : "Gagal mencari.");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [debounced]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const showPanel =
    open &&
    debounced.length >= MIN_CHARS &&
    (loading || error || results.length > 0);

  const handlePick = useCallback(
    async (hit: YoutubeSearchHit) => {
      setAddingId(hit.videoId);
      try {
        await onPick(hit);
        setQ("");
        setDebounced("");
        setResults([]);
        setError(null);
        setOpen(false);
      } finally {
        setAddingId(null);
      }
    },
    [onPick],
  );

  return (
    <div ref={rootRef} className="relative z-40 mx-auto w-full max-w-2xl px-1">
      {showPanel && (
        <button
          type="button"
          aria-label="Tutup hasil pencarian"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="relative z-50">
        <label className="sr-only" htmlFor="room-yt-search">
          Cari lagu di YouTube
        </label>
        <input
          id="room-yt-search"
          type="search"
          autoComplete="off"
          placeholder="Cari di YouTube…"
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (q.trim().length >= MIN_CHARS || debounced.length >= MIN_CHARS) {
              setOpen(true);
            }
          }}
          className="w-full rounded-full border border-white/15 bg-black/40 px-5 py-3 text-sm text-white shadow-inner shadow-black/30 outline-none ring-0 placeholder:text-white/35 focus:border-jam-accent focus:ring-2 focus:ring-jam-accent/35 disabled:opacity-50 sm:py-3.5 sm:text-[15px]"
        />
        {showPanel && (
          <div
            role="listbox"
            aria-label="Hasil pencarian YouTube"
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(60vh,28rem)] overflow-y-auto rounded-2xl border border-white/12 bg-jam-surface py-1 shadow-2xl shadow-black/60"
          >
            {loading && (
              <p className="px-4 py-3 text-sm text-jam-muted">Mencari…</p>
            )}
            {!loading && error && (
              <p className="px-4 py-3 text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            {!loading &&
              results.map((hit) => (
                <button
                  key={hit.videoId}
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={disabled || addingId === hit.videoId}
                  onClick={() => void handlePick(hit)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                >
                  <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-black">
                    <Image
                      src={hit.thumbnail}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized
                    />
                  </div>
                  <span className="line-clamp-2 min-w-0 flex-1 text-sm text-white">
                    {hit.title}
                  </span>
                  <span className="shrink-0 pr-1 text-xs text-jam-muted">
                    {addingId === hit.videoId ? "…" : "Antre"}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
