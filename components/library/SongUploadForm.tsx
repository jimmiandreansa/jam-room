"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authFetch } from "@/lib/apiClient";
import {
  MAX_COVER_BYTES,
  MAX_MP3_BYTES,
  MP3_MIME,
} from "@/lib/songConstants";
import type { Song } from "@/lib/types";

type SongUploadFormProps = {
  getAccessToken: () => Promise<string | null>;
  onUploaded: (song: Song) => void;
};

function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

export function SongUploadForm({ getAccessToken, onUploaded }: SongUploadFormProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadFile(
    uploadUrl: string,
    body: File,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", body.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error("Upload failed."));
      };
      xhr.onerror = () => reject(new Error("Upload failed."));
      xhr.send(body);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const t = title.trim();
    if (!t) {
      setError("Title is required.");
      return;
    }
    if (!file) {
      setError("Choose an MP3 file.");
      return;
    }
    if (file.type !== MP3_MIME && !file.name.toLowerCase().endsWith(".mp3")) {
      setError("Only MP3 files are supported.");
      return;
    }
    if (file.size > MAX_MP3_BYTES) {
      setError("File exceeds 50 MB limit.");
      return;
    }
    if (cover && cover.size > MAX_COVER_BYTES) {
      setError("Cover exceeds 2 MB limit.");
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const presignRes = await authFetch("/api/songs/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "audio",
          contentType: MP3_MIME,
          fileSize: file.size,
        }),
        getAccessToken,
      });
      const presign = (await presignRes.json()) as {
        uploadUrl?: string;
        key?: string;
        error?: string;
      };
      if (!presignRes.ok) throw new Error(presign.error ?? "Presign failed.");

      await uploadFile(presign.uploadUrl!, file, setProgress);

      let coverKey: string | null = null;
      if (cover) {
        const coverPresignRes = await authFetch("/api/songs/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "cover",
            contentType: cover.type,
            fileSize: cover.size,
          }),
          getAccessToken,
        });
        const coverPresign = (await coverPresignRes.json()) as {
          uploadUrl?: string;
          key?: string;
          error?: string;
        };
        if (coverPresignRes.ok && coverPresign.uploadUrl) {
          await uploadFile(coverPresign.uploadUrl, cover);
          coverKey = coverPresign.key ?? null;
        }
      }

      const duration = await readAudioDuration(file);

      const createRes = await authFetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          artist: artist.trim() || null,
          file_key: presign.key,
          cover_key: coverKey,
          duration_seconds: duration,
          file_size_bytes: file.size,
        }),
        getAccessToken,
      });
      const created = (await createRes.json()) as Song & { error?: string };
      if (!createRes.ok) throw new Error(created.error ?? "Failed to save song.");

      onUploaded(created);
      setTitle("");
      setArtist("");
      setFile(null);
      setCover(null);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-2xl border border-white/10 bg-jam-surface/80 p-6"
    >
      <h2 className="text-lg font-semibold text-white">Upload</h2>
      <p className="mt-1 text-xs text-jam-muted">
        Only upload music you own or have the right to distribute. Do not upload
        copyrighted material you do not control.
      </p>
      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-jam-muted">MP3 file</label>
          <input
            type="file"
            accept=".mp3,audio/mpeg"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-jam-muted file:mr-3 file:rounded-lg file:border-0 file:bg-jam-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
          />
        </div>
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
            Cover (optional)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-jam-muted file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
          />
        </div>
        {progress != null && (
          <div className="h-2 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full bg-jam-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
}
