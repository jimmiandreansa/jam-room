"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PlaybackTransport } from "@/components/room/PlaybackTransport";
import { QueueList } from "@/components/room/QueueList";
import { SearchPanel } from "@/components/room/SearchPanel";
import {
  YouTubePlayer,
  type YtPlayerLike,
} from "@/components/room/YouTubePlayer";
import { Button } from "@/components/ui/Button";
import { usePlaybackMode } from "@/hooks/usePlaybackMode";
import { useSupabaseConfigured } from "@/hooks/useSupabaseConfig";
import { isJamRoomHost } from "@/lib/jamHost";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { CurrentPlay, QueueItem, YoutubeSearchHit } from "@/lib/types";
import { useJamStore } from "@/store/jamStore";

type RoomClientProps = {
  roomId: string;
};

function wallElapsedSeconds(startedAt: string | null | undefined): number {
  if (!startedAt) return 0;
  const t = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(0, t);
}

function normalizeQueueRows(rows: unknown[]): QueueItem[] {
  return rows.map((raw, index) => {
    const r = raw as Record<string, unknown>;
    const pos =
      typeof r.position === "number" && !Number.isNaN(r.position)
        ? r.position
        : index + 1;
    return { ...(r as unknown as QueueItem), position: pos };
  });
}

async function fetchQueueForRoom(roomId: string): Promise<QueueItem[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("queue")
    .select("*")
    .eq("room_id", roomId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return normalizeQueueRows(data ?? []);
}

function normalizeCurrentPlay(row: CurrentPlay | null): CurrentPlay | null {
  if (!row) return null;
  return { ...row, is_playing: row.is_playing !== false };
}

async function fetchCurrentPlay(
  roomId: string,
): Promise<CurrentPlay | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("current_play")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) throw error;
  return normalizeCurrentPlay((data as CurrentPlay) ?? null);
}

/**
 * If nothing is marked as playing but the queue has items, promote the first
 * track to `current_play` so every client converges on the same video.
 */
async function ensureCurrentFromQueue(
  roomId: string,
  queue: QueueItem[],
  current: CurrentPlay | null,
): Promise<CurrentPlay | null> {
  if (current?.video_id) return current;
  if (!queue.length) return null;

  const supabase = getSupabaseBrowserClient();
  const first = queue[0];
  const { error } = await supabase.from("current_play").upsert(
    {
      room_id: roomId,
      video_id: first.video_id,
      started_at: new Date().toISOString(),
      is_playing: true,
    },
    { onConflict: "room_id" },
  );
  if (error) throw error;

  return fetchCurrentPlay(roomId);
}

export default function RoomClient({ roomId }: RoomClientProps) {
  const configured = useSupabaseConfigured();
  const { queue, currentVideo, setRoomId, setQueue, setCurrentVideo } =
    useJamStore();
  const [roomName, setRoomName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<"link" | "id" | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHost, setIsHost] = useState(() =>
    typeof window !== "undefined" ? isJamRoomHost(roomId) : false,
  );

  useEffect(() => {
    setIsHost(isJamRoomHost(roomId));
  }, [roomId]);
  const [currentPlayRow, setCurrentPlayRow] = useState<CurrentPlay | null>(
    null,
  );
  const playerRef = useRef<YtPlayerLike | null>(null);
  const [ytPlayer, setYtPlayer] = useState<YtPlayerLike | null>(null);
  const advancingRef = useRef(false);

  const { mode: playbackMode, setMode: setPlaybackMode } = usePlaybackMode(
    roomId,
    isHost,
  );

  useEffect(() => {
    if (!currentVideo?.videoId) {
      playerRef.current = null;
      setYtPlayer(null);
    }
  }, [currentVideo?.videoId]);

  const flashCopyFeedback = useCallback((kind: "link" | "id") => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopyFeedback(kind);
    copyTimerRef.current = setTimeout(() => {
      setCopyFeedback(null);
      copyTimerRef.current = null;
    }, 2000);
  }, []);

  const copyInviteLink = useCallback(async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Salin tautan undangan:", url);
    }
    flashCopyFeedback("link");
  }, [roomId, flashCopyFeedback]);

  const copyRoomId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      window.prompt("Salin ID room:", roomId);
    }
    flashCopyFeedback("id");
  }, [roomId, flashCopyFeedback]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const refreshPlaybackState = useCallback(async () => {
    const [qRows, current] = await Promise.all([
      fetchQueueForRoom(roomId),
      fetchCurrentPlay(roomId),
    ]);
    setQueue(qRows);

    let effectiveCurrent = current;
    if (!effectiveCurrent?.video_id && qRows.length > 0) {
      effectiveCurrent = await ensureCurrentFromQueue(
        roomId,
        qRows,
        effectiveCurrent,
      );
    }

    setCurrentPlayRow(normalizeCurrentPlay(effectiveCurrent));

    if (effectiveCurrent?.video_id) {
      setCurrentVideo({ videoId: effectiveCurrent.video_id });
    } else {
      setCurrentVideo(null);
    }
  }, [roomId, setCurrentVideo, setQueue]);

  useEffect(() => {
    setRoomId(roomId);
    return () => {
      setRoomId(null);
      setQueue([]);
      setCurrentVideo(null);
    };
  }, [roomId, setCurrentVideo, setQueue, setRoomId]);

  useEffect(() => {
    if (!configured) {
      setBootLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setBootLoading(true);
      setLoadError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: room, error } = await supabase
          .from("rooms")
          .select("name")
          .eq("id", roomId)
          .maybeSingle();
        if (error) throw error;
        if (!room) {
          setLoadError("Room tidak ada atau Anda tidak punya akses.");
          return;
        }
        if (!cancelled) setRoomName(room.name as string);
        await refreshPlaybackState();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Gagal memuat room.";
        if (!cancelled) setLoadError(message);
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, roomId, refreshPlaybackState]);

  useEffect(() => {
    if (!configured) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`jam-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void refreshPlaybackState();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "current_play",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void refreshPlaybackState();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [configured, roomId, refreshPlaybackState]);

  const advanceToNextTrack = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: first } = await supabase
        .from("queue")
        .select("id")
        .eq("room_id", roomId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (first?.id) {
        await supabase.from("queue").delete().eq("id", first.id);
      }

      const { data: next } = await supabase
        .from("queue")
        .select("*")
        .eq("room_id", roomId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (next?.video_id) {
        await supabase.from("current_play").upsert(
          {
            room_id: roomId,
            video_id: next.video_id,
            started_at: new Date().toISOString(),
            is_playing: true,
          },
          { onConflict: "room_id" },
        );
      } else {
        await supabase.from("current_play").delete().eq("room_id", roomId);
        setCurrentVideo(null);
      }
      await refreshPlaybackState();
    } finally {
      advancingRef.current = false;
    }
  }, [roomId, refreshPlaybackState, setCurrentVideo]);

  /** End-of-track fallback: runs even when tab visible so host stays in sync if guest advances. */
  useEffect(() => {
    const vid = currentVideo?.videoId;
    if (!vid) return;

    const tick = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const dur = p.getDuration();
        const t = p.getCurrentTime();
        if (dur > 0 && t >= dur - 0.75) {
          void advanceToNextTrack();
        }
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [currentVideo?.videoId, advanceToNextTrack]);

  const roomIsPlaying = currentPlayRow?.is_playing !== false;

  const setRoomPlaying = useCallback(
    async (playing: boolean) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("current_play")
        .update({ is_playing: playing })
        .eq("room_id", roomId);
      if (error) {
        console.error("[setRoomPlaying]", error);
        return;
      }
      await refreshPlaybackState();
    },
    [roomId, refreshPlaybackState],
  );

  useEffect(() => {
    if (!ytPlayer) return;
    try {
      if (roomIsPlaying) ytPlayer.playVideo();
      else ytPlayer.pauseVideo();
    } catch {
      /* ignore */
    }
  }, [ytPlayer, roomIsPlaying, currentPlayRow?.video_id]);

  const handleAddToQueue = useCallback(
    async (hit: YoutubeSearchHit) => {
      const supabase = getSupabaseBrowserClient();
      const { data: maxRow } = await supabase
        .from("queue")
        .select("position")
        .eq("room_id", roomId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextPos =
        typeof maxRow?.position === "number" && !Number.isNaN(maxRow.position)
          ? maxRow.position + 1
          : 1;

      const { error } = await supabase.from("queue").insert({
        room_id: roomId,
        video_id: hit.videoId,
        title: hit.title,
        thumbnail: hit.thumbnail,
        position: nextPos,
      });
      if (error) throw error;
      await refreshPlaybackState();
    },
    [roomId, refreshPlaybackState],
  );

  const handleReorder = useCallback(
    async (orderedIds: string[]) => {
      const supabase = getSupabaseBrowserClient();
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from("queue")
            .update({ position: index + 1 })
            .eq("id", id)
            .eq("room_id", roomId),
        ),
      );
      await refreshPlaybackState();
    },
    [roomId, refreshPlaybackState],
  );

  const nowTitle =
    queue.find((q) => q.video_id === currentVideo?.videoId)?.title ?? null;

  const initialSeek = wallElapsedSeconds(currentPlayRow?.started_at);

  const toggleRoomPlayPause = useCallback(() => {
    void setRoomPlaying(!roomIsPlaying);
  }, [roomIsPlaying, setRoomPlaying]);

  if (!configured) {
    return (
      <PageShell title="Jam Room" subtitle="Konfigurasi diperlukan">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-sm text-amber-100">
          <p className="font-medium">
            Variabel lingkungan Supabase belum diatur.
          </p>
          <p className="mt-2 text-amber-100/80">
            Tambahkan{" "}
            <code className="rounded bg-black/30 px-1">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            dan{" "}
            <code className="rounded bg-black/30 px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            ke <code className="rounded bg-black/30 px-1">.env.local</code>, lalu
            jalankan ulang server pengembangan.
          </p>
          <div className="mt-4">
            <Link href="/">
              <Button type="button">Kembali ke beranda</Button>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell title="Jam Room" subtitle="Terjadi kesalahan">
        <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200">
          {loadError}
          <div className="mt-4">
            <Link href="/">
              <Button type="button">Kembali ke beranda</Button>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const vid = currentVideo?.videoId ?? null;
  const playbackKey = `${vid ?? ""}-${playbackMode}`;

  return (
    <PageShell
      title={roomName ? roomName : "Jam Room"}
      subtitle={`ID room: ${roomId}`}
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Link
          href="/"
          className="text-sm text-jam-muted underline-offset-4 hover:text-white hover:underline"
        >
          ← Tinggalkan room
        </Link>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 px-4 py-2 text-xs sm:text-sm"
              onClick={() => void copyInviteLink()}
            >
              Salin tautan undangan
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 px-4 py-2 text-xs sm:text-sm"
              onClick={() => void copyRoomId()}
            >
              Salin ID room
            </Button>
          </div>
          {copyFeedback === "link" && (
            <p className="text-xs text-jam-accent" role="status">
              Tautan disalin.
            </p>
          )}
          {copyFeedback === "id" && (
            <p className="text-xs text-jam-accent" role="status">
              ID disalin.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <section className="space-y-3">
          {!isHost && (
            <div className="rounded-2xl border border-white/10 bg-jam-surface/60 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-jam-muted">
                Audio di perangkat ini (tamu)
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setPlaybackMode("local")}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    playbackMode === "local"
                      ? "bg-jam-accent text-black ring-1 ring-jam-accent"
                      : "bg-black/30 text-jam-muted hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="font-medium">Putar di perangkat saya</span>
                  <span className="mt-0.5 block text-xs opacity-90">
                    Audio + video di speaker Anda; sinkron dengan room.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlaybackMode("follow_host")}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    playbackMode === "follow_host"
                      ? "bg-jam-accent text-black ring-1 ring-jam-accent"
                      : "bg-black/30 text-jam-muted hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="font-medium">Tanpa pemutar di sini</span>
                  <span className="mt-0.5 block text-xs opacity-90">
                    Video jalan (bisu); dengar dari speaker host di dekat Anda.
                  </span>
                </button>
              </div>
            </div>
          )}

          <YouTubePlayer
            videoId={vid}
            playbackKey={playbackKey}
            muted={playbackMode === "follow_host"}
            roomIsPlaying={roomIsPlaying}
            initialSeekSeconds={initialSeek}
            onEnd={() => void advanceToNextTrack()}
            onPlayerReady={(p) => {
              playerRef.current = p;
              setYtPlayer(p);
            }}
            onPlayerChange={(p) => {
              playerRef.current = p;
              setYtPlayer(p);
            }}
          />

          <PlaybackTransport
            hasVideo={Boolean(vid)}
            roomIsPlaying={roomIsPlaying}
            onPlayPause={toggleRoomPlayPause}
            onNext={() => void advanceToNextTrack()}
            nextDisabled={bootLoading}
          />

          {nowTitle && (
            <p className="truncate text-center text-sm text-jam-muted">
              Sedang diputar:{" "}
              <span className="font-medium text-white">{nowTitle}</span>
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-jam-muted">
              Antrean
            </h2>
            {bootLoading && (
              <span className="text-xs text-jam-muted">Menyinkronkan…</span>
            )}
          </div>
          <QueueList
            items={queue}
            currentVideoId={currentVideo?.videoId ?? null}
            loading={bootLoading && queue.length === 0}
            onReorder={handleReorder}
            reorderDisabled={bootLoading}
          />
        </section>

        <SearchPanel onPick={handleAddToQueue} disabled={bootLoading} />
      </div>
    </PageShell>
  );
}
