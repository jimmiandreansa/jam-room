"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthButton } from "@/components/auth/AuthButton";
import { SongList } from "@/components/library/SongList";
import { SongUploadForm } from "@/components/library/SongUploadForm";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/apiClient";
import type { Song } from "@/lib/types";

export function LibraryClient() {
  const { user, loading, configured, signInWithGoogle, getAccessToken } =
    useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const loadSongs = useCallback(async () => {
    setListLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch("/api/songs", { getAccessToken });
      const body = (await res.json()) as { items?: Song[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load songs.");
      setSongs(body.items ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load songs.");
    } finally {
      setListLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user) void loadSongs();
    else setSongs([]);
  }, [user, loadSongs]);

  if (!configured) {
    return (
      <PageShell title="My Library" subtitle="Configuration required">
        <p className="text-sm text-jam-muted">
          Set Supabase environment variables in <code>.env.local</code>.
        </p>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell title="My Library" subtitle="Loading…">
        <p className="text-sm text-jam-muted">Loading…</p>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell
        title="My Library"
        subtitle="Sign in to upload and manage your tracks."
      >
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-jam-surface/80 p-8 text-center">
          <p className="text-sm text-jam-muted">
            Google sign-in is required to upload MP3 files to the shared library.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => void signInWithGoogle().catch(console.error)}
          >
            Sign in with Google
          </Button>
          <p className="mt-4">
            <Link href="/" className="text-sm text-jam-accent hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="My Library"
      subtitle="Upload tracks to the public catalog. Anyone can play them in jam rooms."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm text-jam-muted underline-offset-4 hover:text-white hover:underline"
        >
          ← Home
        </Link>
        <AuthButton />
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <SongUploadForm
          getAccessToken={getAccessToken}
          onUploaded={(song) => setSongs((prev) => [song, ...prev])}
        />

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">Your songs</h2>
          {listLoading && (
            <p className="text-sm text-jam-muted">Loading…</p>
          )}
          {loadError && (
            <p className="text-sm text-red-400" role="alert">
              {loadError}
            </p>
          )}
          {!listLoading && !loadError && (
            <SongList
              songs={songs}
              getAccessToken={getAccessToken}
              onChange={setSongs}
            />
          )}
        </section>
      </div>
    </PageShell>
  );
}
