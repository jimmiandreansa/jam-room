"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authFetch } from "@/lib/apiClient";
import { DEFAULT_COVER_URL } from "@/lib/songConstants";
import type { Song } from "@/lib/types";
import { SongEditModal } from "@/components/library/SongEditModal";

type SongListProps = {
  songs: Song[];
  getAccessToken: () => Promise<string | null>;
  onChange: (songs: Song[]) => void;
};

export function SongList({ songs, getAccessToken, onChange }: SongListProps) {
  const [editing, setEditing] = useState<Song | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(song: Song) {
    if (
      !window.confirm(
        "Delete this song? It will be removed from all jam queues.",
      )
    ) {
      return;
    }
    setDeletingId(song.id);
    try {
      const res = await authFetch(`/api/songs/${song.id}`, {
        method: "DELETE",
        getAccessToken,
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Delete failed.");
      onChange(songs.filter((s) => s.id !== song.id));
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  if (songs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-jam-surface/80 p-6 text-sm text-jam-muted">
        No songs yet. Upload your first track above.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-jam-surface/80">
        <ul className="divide-y divide-white/10">
          {songs.map((song) => (
            <li
              key={song.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black">
                <Image
                  src={song.cover_url || DEFAULT_COVER_URL}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{song.title}</p>
                {song.artist ? (
                  <p className="truncate text-xs text-jam-muted">{song.artist}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => setEditing(song)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-1.5 text-xs text-red-300 hover:text-red-200"
                  disabled={deletingId === song.id}
                  onClick={() => void handleDelete(song)}
                >
                  {deletingId === song.id ? "…" : "Delete"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {editing && (
        <SongEditModal
          song={editing}
          getAccessToken={getAccessToken}
          onSaved={(updated) => {
            onChange(songs.map((s) => (s.id === updated.id ? updated : s)));
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
