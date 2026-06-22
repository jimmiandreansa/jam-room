"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { AudioPlayer } from "@/components/room/AudioPlayer";
import type { AudioPlayerLike } from "@/lib/audioPlayer";
import { PlaybackTransport } from "@/components/room/PlaybackTransport";
import { QueueList } from "@/components/room/QueueList";
import { RoomMemberList } from "@/components/room/RoomMemberList";
import { RoomSongSearch } from "@/components/room/RoomSongSearch";
import { VolumeControl } from "@/components/room/VolumeControl";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useLocalVolume } from "@/hooks/useLocalVolume";
import { usePlaybackMode } from "@/hooks/usePlaybackMode";
import { useRoomPresence } from "@/hooks/useRoomPresence";
import { useSupabaseConfigured } from "@/hooks/useSupabaseConfig";
import { getOrCreateJamContributorLabel } from "@/lib/jamContributorIdentity";
import { isJamRoomHost } from "@/lib/jamHost";
import { DEFAULT_COVER_URL } from "@/lib/songConstants";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type {
  CurrentPlay,
  CurrentTrackState,
  QueueItem,
  SongSearchHit,
} from "@/lib/types";
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

async function fetchStreamForSong(songId: string): Promise<{
  url: string;
  coverUrl: string | null;
}> {
  const res = await fetch(`/api/songs/${songId}/stream`);
  const body = (await res.json().catch(() => ({}))) as {
    url?: string;
    coverUrl?: string | null;
    error?: string;
  };
  if (!res.ok || !body.url) {
    throw new Error(body.error ?? "Gagal memuat audio.");
  }
  return { url: body.url, coverUrl: body.coverUrl ?? null };
}

async function buildCurrentTrack(
  songId: string,
  queue: QueueItem[],
): Promise<CurrentTrackState> {
  const queueItem = queue.find((q) => q.song_id === songId);
  const stream = await fetchStreamForSong(songId);
  return {
    songId,
    audioUrl: stream.url,
    title: queueItem?.title ?? "Unknown track",
    artist: null,
    coverUrl: stream.coverUrl ?? queueItem?.thumbnail ?? DEFAULT_COVER_URL,
  };
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

async function fetchCurrentPlay(roomId: string): Promise<CurrentPlay | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("current_play")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) throw error;
  return normalizeCurrentPlay((data as CurrentPlay) ?? null);
}

async function ensureCurrentFromQueue(
  roomId: string,
  queue: QueueItem[],
  current: CurrentPlay | null,
): Promise<CurrentPlay | null> {
  if (current?.song_id) return current;
  if (!queue.length) return null;

  const supabase = getSupabaseBrowserClient();
  const first = queue[0];
  const { error } = await supabase.from("current_play").upsert(
    {
      room_id: roomId,
      song_id: first.song_id,
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
  const { queue, currentTrack, setRoomId, setQueue, setCurrentTrack } =
    useJamStore();
  const [roomName, setRoomName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<"link" | "id" | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHost, setIsHost] = useState(() =>
    typeof window !== "undefined" ? isJamRoomHost(roomId) : false,
  );
  const [selfContributor, setSelfContributor] = useState<string | null>(null);
  const [currentPlayRow, setCurrentPlayRow] = useState<CurrentPlay | null>(
    null,
  );
  const playerRef = useRef<AudioPlayerLike | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<AudioPlayerLike | null>(null);
  const advancingRef = useRef(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const { user } = useAuth();
  const { volume, setVolume } = useLocalVolume();
  const { mode: playbackMode, setMode: setPlaybackMode } = usePlaybackMode(
    roomId,
    isHost,
  );
  const isMutedGuest = !isHost && playbackMode === "follow_host";

  useEffect(() => {
    setIsHost(isJamRoomHost(roomId));
  }, [roomId]);

  useEffect(() => {
    setSelfContributor(getOrCreateJamContributorLabel());
  }, []);

  useEffect(() => {
    if (!currentTrack?.songId) {
      playerRef.current = null;
      setAudioPlayer(null);
    }
  }, [currentTrack?.songId]);

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

  const refreshQueueOnly = useCallback(async () => {
    const qRows = await fetchQueueForRoom(roomId);
    setQueue(qRows);

    const current = await fetchCurrentPlay(roomId);
    if (!current?.song_id && qRows.length > 0) {
      await ensureCurrentFromQueue(roomId, qRows, current);
    }

    return qRows;
  }, [roomId, setQueue]);

  const refreshCurrentPlayState = useCallback(
    async (qRows?: QueueItem[]) => {
      const queueRows = qRows ?? (await fetchQueueForRoom(roomId));

      let effectiveCurrent = await fetchCurrentPlay(roomId);
      if (!effectiveCurrent?.song_id && queueRows.length > 0) {
        effectiveCurrent = await ensureCurrentFromQueue(
          roomId,
          queueRows,
          effectiveCurrent,
        );
      }

      setCurrentPlayRow(normalizeCurrentPlay(effectiveCurrent));

      const nextSongId = effectiveCurrent?.song_id ?? null;
      if (!nextSongId) {
        setCurrentTrack(null);
        return;
      }

      const existing = useJamStore.getState().currentTrack;
      if (existing?.songId === nextSongId && existing.audioUrl) {
        return;
      }

      try {
        setAudioError(null);
        const track = await buildCurrentTrack(nextSongId, queueRows);
        setCurrentTrack(track);
      } catch (e) {
        setAudioError(e instanceof Error ? e.message : "Gagal memuat lagu.");
        setCurrentTrack(null);
      }
    },
    [roomId, setCurrentTrack],
  );

  const refreshPlaybackState = useCallback(async () => {
    const qRows = await refreshQueueOnly();
    await refreshCurrentPlayState(qRows);
  }, [refreshQueueOnly, refreshCurrentPlayState]);

  useEffect(() => {
    setRoomId(roomId);
    return () => {
      setRoomId(null);
      setQueue([]);
      setCurrentTrack(null);
    };
  }, [roomId, setCurrentTrack, setQueue, setRoomId]);

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
        const message = e instanceof Error ? e.message : "Gagal memuat room.";
        if (!cancelled) setLoadError(message);
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, roomId, refreshPlaybackState]);

  const {
    members,
    status: presenceStatus,
    presenceKey,
  } = useRoomPresence({
    roomId,
    user,
    anonymousLabel: selfContributor ?? "",
    isHost,
    enabled: configured && !loadError,
    onQueueChange: refreshQueueOnly,
    onCurrentPlayChange: refreshCurrentPlayState,
  });

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

      if (next?.song_id) {
        await supabase.from("current_play").upsert(
          {
            room_id: roomId,
            song_id: next.song_id,
            started_at: new Date().toISOString(),
            is_playing: true,
          },
          { onConflict: "room_id" },
        );
      } else {
        await supabase.from("current_play").delete().eq("room_id", roomId);
        setCurrentTrack(null);
      }
      await refreshPlaybackState();
    } finally {
      advancingRef.current = false;
    }
  }, [roomId, refreshPlaybackState, setCurrentTrack]);

  useEffect(() => {
    const sid = currentTrack?.songId;
    if (!sid) return;

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
  }, [currentTrack?.songId, advanceToNextTrack]);

  const roomIsPlaying = currentPlayRow?.is_playing !== false;

  const nowQueueItem = queue.find((q) => q.song_id === currentTrack?.songId);
  const nowTitle = nowQueueItem?.title ?? currentTrack?.title ?? null;

  const setRoomPlaying = useCallback(
    async (playing: boolean) => {
      setCurrentPlayRow((prev) =>
        prev ? { ...prev, is_playing: playing } : prev,
      );
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("current_play")
        .update({ is_playing: playing })
        .eq("room_id", roomId);
      if (error) {
        console.error("[setRoomPlaying]", error);
        await refreshCurrentPlayState();
        return;
      }
    },
    [roomId, refreshCurrentPlayState],
  );

  useEffect(() => {
    if (!audioPlayer) return;
    try {
      if (roomIsPlaying) void audioPlayer.play();
      else audioPlayer.pause();
    } catch {
      /* ignore */
    }
  }, [audioPlayer, roomIsPlaying, currentPlayRow?.song_id]);

  const handleAddToQueue = useCallback(
    async (hit: SongSearchHit) => {
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

      const addedBy = getOrCreateJamContributorLabel();
      const { error } = await supabase.from("queue").insert({
        room_id: roomId,
        song_id: hit.songId,
        title: hit.title,
        thumbnail: hit.thumbnail,
        position: nextPos,
        added_by_label: addedBy || null,
      });
      if (error) throw error;
    },
    [roomId],
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
    },
    [roomId],
  );

  const initialSeek = wallElapsedSeconds(currentPlayRow?.started_at);

  const toggleRoomPlayPause = useCallback(() => {
    void setRoomPlaying(!roomIsPlaying);
  }, [roomIsPlaying, setRoomPlaying]);

  const handleAudioError = useCallback(() => {
    setAudioError("Gagal memuat lagu. Mencoba lagu berikutnya…");
    void advanceToNextTrack();
  }, [advanceToNextTrack]);

  if (!configured) {
    return (
      <PageShell title="Jam Room" subtitle="Konfigurasi diperlukan">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-sm text-amber-100">
          <p className="font-medium">
            Supabase environment variables are not set.
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
            ke <code className="rounded bg-black/30 px-1">.env.local</code>,
            lalu jalankan ulang server pengembangan.
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

  const songId = currentTrack?.songId ?? null;

  return (
    <PageShell
      wide
      densePadding
      title={roomName ? roomName : "Jam Room"}
      subtitle={`ID room: ${roomId}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
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

      <div className="relative z-30 mb-5 flex justify-center sm:mb-6">
        <RoomSongSearch onPick={handleAddToQueue} disabled={bootLoading} />
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
        <div className="flex min-w-0 flex-col gap-4">
          {!isHost && (
            <div className="rounded-xl border border-white/10 bg-jam-surface/60 p-3">
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
                    Audio di speaker Anda; sinkron dengan room.
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
                    Audio jalan (bisu); dengar dari speaker host di dekat Anda.
                  </span>
                </button>
              </div>
            </div>
          )}

          {audioError && (
            <p className="text-center text-sm text-amber-200" role="alert">
              {audioError}
            </p>
          )}

          <AudioPlayer
            songId={songId}
            audioUrl={currentTrack?.audioUrl ?? null}
            title={currentTrack?.title ?? null}
            artist={currentTrack?.artist ?? null}
            coverUrl={currentTrack?.coverUrl ?? null}
            muted={isMutedGuest}
            volume={volume}
            roomIsPlaying={roomIsPlaying}
            initialSeekSeconds={initialSeek}
            onEnd={() => void advanceToNextTrack()}
            onError={handleAudioError}
            onPlayerReady={(p) => {
              playerRef.current = p;
              setAudioPlayer(p);
            }}
            onPlayerChange={(p) => {
              playerRef.current = p;
              setAudioPlayer(p);
            }}
          />

          <PlaybackTransport
            hasTrack={Boolean(songId)}
            roomIsPlaying={roomIsPlaying}
            onPlayPause={toggleRoomPlayPause}
            onNext={() => void advanceToNextTrack()}
            nextDisabled={bootLoading}
          />

          <VolumeControl
            volume={volume}
            onChange={setVolume}
            disabled={isMutedGuest}
          />

          {nowTitle && (
            <p className="truncate text-center text-sm text-jam-muted lg:text-left">
              Sedang diputar:{" "}
              <span className="font-medium text-white">{nowTitle}</span>
            </p>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <RoomMemberList
            members={members}
            status={presenceStatus}
            selfPresenceKey={presenceKey}
          />

          {selfContributor ? (
            <p className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-jam-muted">
              Identitas antrean Anda:{" "}
              <span className="font-medium text-white">{selfContributor}</span>
            </p>
          ) : null}

          <section className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-jam-muted">
                Antrean
              </h2>
              {bootLoading && (
                <span className="shrink-0 text-xs text-jam-muted">
                  Menyinkronkan…
                </span>
              )}
            </div>
            <QueueList
              items={queue}
              currentSongId={currentTrack?.songId ?? null}
              loading={bootLoading && queue.length === 0}
              onReorder={handleReorder}
              reorderDisabled={bootLoading}
              scrollable={false}
            />
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
