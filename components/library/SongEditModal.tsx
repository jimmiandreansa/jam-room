"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authFetch } from "@/lib/apiClient";
import { MAX_COVER_BYTES } from "@/lib/songConstants";
import type { Song } from "@/lib/types";

type SongEditModalProps = {
  song: Song;
  getAccessToken: () => Promise<string | null>;
  onSaved: (song: Song) => void;
  onClose: () => void;
};

async function uploadCover(
  file: File,
  getAccessToken: () => Promise<string | null>,
): Promise<string | null> {
  const presignRes = await authFetch("/api/songs/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "cover",
      contentType: file.type,
      fileSize: file.size,
    }),
    getAccessToken,
  });
  const presign = (await presignRes.json()) as {
    uploadUrl?: string;
    key?: string;
    error?: string;
  };
  if (!presignRes.ok || !presign.uploadUrl) return null;

  await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return presign.key ?? null;
}

export function SongEditModal({
  song,
  getAccessToken,
  onSaved,
  onClose,
}: SongEditModalProps) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist ?? "");
  const [cover, setCover] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const t = title.trim();
    if (!t) {
      setError("Title is required.");
      return;
    }
    if (cover && cover.size > MAX_COVER_BYTES) {
      setError("Cover exceeds 2 MB limit.");
      return;
    }

    setBusy(true);
    try {
      let coverKey: string | null | undefined;
      if (cover) {
        coverKey = await uploadCover(cover, getAccessToken);
      }

      const body: Record<string, unknown> = {
        title: t,
        artist: artist.trim() || null,
      };
      if (coverKey !== undefined) body.cover_key = coverKey;

      const res = await authFetch(`/api/songs/${song.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        getAccessToken,
      });
      const updated = (await res.json()) as Song & { error?: string };
      if (!res.ok) throw new Error(updated.error ?? "Update failed.");
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-song-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-jam-surface p-6 shadow-xl">
        <h2 id="edit-song-title" className="text-lg font-semibold text-white">
          Edit song
        </h2>
        <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-4">
          <Input
            label="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
          <Input
            label="Artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            disabled={busy}
          />
          <div>
            <label className="mb-1 block text-sm text-jam-muted">
              New cover (optional)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-jam-muted"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
