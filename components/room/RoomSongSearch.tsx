"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SongSearchHit } from "@/lib/types";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_LIMIT,
  SEARCH_MIN_CHARS,
} from "@/lib/songConstants";

type RoomSongSearchProps = {
  onPick: (hit: SongSearchHit) => Promise<void>;
  disabled?: boolean;
};

export function RoomSongSearch({ onPick, disabled }: RoomSongSearchProps) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebounced(q.trim());
      debounceTimerRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [q]);

  const [results, setResults] = useState<SongSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounced.length < SEARCH_MIN_CHARS) {
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

    const url = `/api/songs/search?q=${encodeURIComponent(debounced)}&limit=${SEARCH_LIMIT}`;
    fetch(url, { signal: ac.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          items?: SongSearchHit[];
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
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handlePick = useCallback(
    async (hit: SongSearchHit) => {
      if (disabled || addingId) return;
      setAddingId(hit.songId);
      try {
        await onPick(hit);
        setQ("");
        setDebounced("");
        setOpen(false);
      } finally {
        setAddingId(null);
      }
    },
    [addingId, disabled, onPick],
  );

  return (
    <div ref={rootRef} className="relative w-full max-w-xl">
      <label className="sr-only" htmlFor="room-song-search">
        Cari lagu
      </label>
      <input
        id="room-song-search"
        type="search"
        placeholder="Cari lagu di library…"
        value={q}
        disabled={disabled}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full rounded-2xl border border-white/15 bg-jam-surface/90 px-4 py-3 text-sm text-white placeholder:text-jam-muted focus:border-jam-accent focus:outline-none focus:ring-1 focus:ring-jam-accent disabled:opacity-50"
        autoComplete="off"
      />
      {open && (loading || error || results.length > 0 || debounced.length >= SEARCH_MIN_CHARS) && (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-jam-surface shadow-xl"
          role="listbox"
        >
          {loading && (
            <li className="px-4 py-3 text-sm text-jam-muted">Mencari…</li>
          )}
          {!loading && error && (
            <li className="px-4 py-3 text-sm text-jam-muted">{error}</li>
          )}
          {!loading &&
            results.map((hit) => (
              <li key={hit.songId}>
                <button
                  type="button"
                  disabled={Boolean(addingId)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/5 disabled:opacity-50"
                  onClick={() => void handlePick(hit)}
                >
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-black">
                    <Image
                      src={hit.thumbnail}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {hit.title}
                    </p>
                    {hit.artist ? (
                      <p className="truncate text-xs text-jam-muted">
                        {hit.artist}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-jam-accent">
                    {addingId === hit.songId ? "…" : "+ Antrean"}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
