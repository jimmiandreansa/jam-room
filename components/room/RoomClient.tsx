"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PlaybackTransport } from "@/components/room/PlaybackTransport";
import { QueueList } from "@/components/room/QueueList";
import { RoomMembers } from "@/components/room/RoomMembers";
import { RoomRecommendations } from "@/components/room/RoomRecommendations";
import { RoomYouTubeSearch } from "@/components/room/RoomYouTubeSearch";
import { VolumeControl } from "@/components/room/VolumeControl";
import {
  YouTubePlayer,
  type YtPlayerLike,
} from "@/components/room/YouTubePlayer";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAutoplay } from "@/hooks/useAutoplay";
import { useEndOfTrackBrowserNotification } from "@/hooks/useEndOfTrackBrowserNotification";
import { useHostPictureInPicture } from "@/hooks/useHostPictureInPicture";
import { useLocalVolume } from "@/hooks/useLocalVolume";
import { usePlaybackMode } from "@/hooks/usePlaybackMode";
import { useRoomRecommendations } from "@/hooks/useRoomRecommendations";
import { useRoomPresence } from "@/hooks/useRoomPresence";
import { useSupabaseConfigured } from "@/hooks/useSupabaseConfig";
import { getOrCreateJamContributorLabel } from "@/lib/jamContributorIdentity";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHost, setIsHost] = useState(() =>
    typeof window !== "undefined" ? isJamRoomHost(roomId) : false,
  );
  const [selfContributor, setSelfContributor] = useState<string | null>(null);
  const [currentPlayRow, setCurrentPlayRow] = useState<CurrentPlay | null>(
    null,
  );
  const playerRef = useRef<YtPlayerLike | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [ytPlayer, setYtPlayer] = useState<YtPlayerLike | null>(null);
  const advancingRef = useRef(false);
  const playedIdsRef = useRef<Set<string>>(new Set());
  const recommendationsRef = useRef<YoutubeSearchHit[]>([]);
  const autoplayRef = useRef(false);
  const isHostRef = useRef(isHost);

  const { user } = useAuth();
  const { volume, setVolume } = useLocalVolume();
  const { mode: playbackMode, setMode: setPlaybackMode } = usePlaybackMode(
    roomId,
    isHost,
  );
  const { autoplay, setAutoplay } = useAutoplay(roomId, isHost);
  const isMutedGuest = !isHost && playbackMode === "follow_host";

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  useEffect(() => {
    const v = currentVideo?.videoId;
    if (v) playedIdsRef.current.add(v);
  }, [currentVideo?.videoId]);

  useEffect(() => {
    setIsHost(isJamRoomHost(roomId));
  }, [roomId]);

  useEffect(() => {
    setSelfContributor(getOrCreateJamContributorLabel());
  }, []);

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

  useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  const refreshQueueOnly = useCallback(async () => {
    const qRows = await fetchQueueForRoom(roomId);
    setQueue(qRows);

    const current = await fetchCurrentPlay(roomId);
    if (!current?.video_id && qRows.length > 0) {
      await ensureCurrentFromQueue(roomId, qRows, current);
    }

    return qRows;
  }, [roomId, setQueue]);

  const refreshCurrentPlayState = useCallback(
    async (qRows?: QueueItem[]) => {
      const queueRows = qRows ?? (await fetchQueueForRoom(roomId));

      let effectiveCurrent = await fetchCurrentPlay(roomId);
      if (!effectiveCurrent?.video_id && queueRows.length > 0) {
        effectiveCurrent = await ensureCurrentFromQueue(
          roomId,
          queueRows,
          effectiveCurrent,
        );
      }

      setCurrentPlayRow(normalizeCurrentPlay(effectiveCurrent));

      const nextVideoId = effectiveCurrent?.video_id ?? null;
      if (!nextVideoId) {
        setCurrentVideo(null);
        return;
      }
      setCurrentVideo({ videoId: nextVideoId });
    },
    [roomId, setCurrentVideo],
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
      } else if (isHostRef.current && autoplayRef.current) {
        // Queue empty + host autoplay on: promote the top unplayed recommendation.
        const rec = recommendationsRef.current.find(
          (r) => !playedIdsRef.current.has(r.videoId),
        );
        if (rec) {
          await supabase.from("queue").insert({
            room_id: roomId,
            video_id: rec.videoId,
            title: rec.title,
            thumbnail: rec.thumbnail,
            position: 1,
            added_by_label: "🎧 Autoplay",
          });
          await supabase.from("current_play").upsert(
            {
              room_id: roomId,
              video_id: rec.videoId,
              started_at: new Date().toISOString(),
              is_playing: true,
            },
            { onConflict: "room_id" },
          );
        } else {
          await supabase.from("current_play").delete().eq("room_id", roomId);
          setCurrentVideo(null);
        }
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

  const nowQueueItem = queue.find((q) => q.video_id === currentVideo?.videoId);
  const nowTitle = nowQueueItem?.title ?? null;
  const nowThumbnail = nowQueueItem?.thumbnail ?? null;

  const excludeIds = useMemo(() => {
    const s = new Set<string>();
    if (currentVideo?.videoId) s.add(currentVideo.videoId);
    playedIdsRef.current.forEach((id) => s.add(id));
    queue.forEach((q) => s.add(q.video_id));
    return Array.from(s);
  }, [currentVideo?.videoId, queue]);

  const {
    recommendations,
    loading: recommendationsLoading,
    error: recommendationsError,
  } = useRoomRecommendations({
    currentVideoId: currentVideo?.videoId ?? null,
    excludeIds,
    enabled: configured && !loadError,
  });

  useEffect(() => {
    recommendationsRef.current = recommendations;
  }, [recommendations]);

  const endNotif = useEndOfTrackBrowserNotification(playerRef, {
    videoId: currentVideo?.videoId ?? null,
    trackTitle: nowTitle,
    roomIsPlaying,
    isHost,
  });

  const hostPip = useHostPictureInPicture({
    isHost,
    containerRef: playerContainerRef,
    trackTitle: nowTitle,
    trackThumbnail: nowThumbnail,
    isPlaying: roomIsPlaying,
    hasVideo: Boolean(currentVideo?.videoId),
  });

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

      const addedBy = getOrCreateJamContributorLabel();
      const { error } = await supabase.from("queue").insert({
        room_id: roomId,
        video_id: hit.videoId,
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

  const vid = currentVideo?.videoId ?? null;
  const playbackKey = `${vid ?? ""}-${playbackMode}`;

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
          <div className="flex flex-wrap items-center gap-2">
            <RoomMembers
              members={members}
              status={presenceStatus}
              selfPresenceKey={presenceKey}
            />
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
        <RoomYouTubeSearch
          onPick={handleAddToQueue}
          disabled={bootLoading}
          suggestions={recommendations}
          suggestionsLoading={recommendationsLoading}
        />
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
            containerRef={playerContainerRef}
            muted={isMutedGuest}
            volume={volume}
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
            showPipButton={isHost}
            pipSupported={hostPip.supported}
            isInPiP={hostPip.isInPiP}
            onEnterPip={hostPip.enterPiP}
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

          {isHost && (
            <div className="rounded-xl border border-white/10 bg-jam-surface/40 px-3 py-2.5 text-xs text-jam-muted sm:px-4 sm:text-sm">
              <p className="font-medium text-white">
                PiP otomatis saat pindah tab (host)
              </p>
              <p className="mt-1 text-[11px] leading-relaxed sm:text-xs">
                Saat Anda pindah tab, mini player muncul agar lagu tetap jalan.
                Didukung di Chrome/Edge desktop; gunakan tombol PiP di bawah
                video jika auto tidak jalan. Chrome mungkin meminta izin
                &quot;automatic picture-in-picture&quot; saat pertama kali.
              </p>
              {!hostPip.supported ? (
                <p className="mt-2 text-[11px] text-jam-muted/90 sm:text-xs">
                  Peramban ini tidak mendukung Document Picture-in-Picture.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!hostPip.userEnabled ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => hostPip.setUserEnabled(true)}
                    >
                      Aktifkan PiP otomatis
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => hostPip.setUserEnabled(false)}
                      >
                        Nonaktifkan PiP otomatis
                      </Button>
                      {hostPip.isInPiP && (
                        <span className="text-xs text-jam-accent" role="status">
                          PiP aktif
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {isHost && (
            <div className="rounded-xl border border-white/10 bg-jam-surface/40 px-3 py-2.5 text-xs text-jam-muted sm:px-4 sm:text-sm">
              <p className="font-medium text-white">
                Peringatan hampir habis (host)
              </p>
              <p className="mt-1 text-[11px] leading-relaxed sm:text-xs">
                Tab tidak aktif kadang menahan lagu berikutnya. Aktifkan
                notifikasi untuk diingatkan sekitar 7 detik sebelum selesai;
                ketuk notifikasi untuk kembali ke tab ini.
              </p>
              {!endNotif.notifSupported ? (
                <p className="mt-2 text-[11px] text-jam-muted/90 sm:text-xs">
                  Peramban ini tidak mendukung notifikasi desktop.
                </p>
              ) : endNotif.permission === "denied" ? (
                <p className="mt-2 text-[11px] text-amber-200/90 sm:text-xs">
                  Notifikasi diblokir. Ubah izin situs di pengaturan browser jika
                  ingin memakai fitur ini.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {endNotif.permission === "default" && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => void endNotif.requestAndEnable()}
                    >
                      Izinkan & aktifkan peringatan
                    </Button>
                  )}
                  {endNotif.permission === "granted" &&
                    endNotif.userEnabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => endNotif.setUserEnabled(false)}
                      >
                        Nonaktifkan peringatan
                      </Button>
                    )}
                  {endNotif.permission === "granted" &&
                    !endNotif.userEnabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => endNotif.setUserEnabled(true)}
                      >
                        Aktifkan peringatan
                      </Button>
                    )}
                  {endNotif.permission === "granted" &&
                    endNotif.userEnabled && (
                      <span className="text-xs text-jam-accent" role="status">
                        Peringatan aktif
                      </span>
                    )}
                </div>
              )}
            </div>
          )}
        </div>

        <aside
          className={`fixed right-0 top-0 z-50 flex h-full w-[86%] min-w-0 max-w-sm flex-col gap-4 overflow-y-auto border-l border-white/10 bg-jam-bg p-4 shadow-2xl shadow-black/60 transition-transform duration-300 lg:static lg:z-auto lg:h-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none ${
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-jam-muted">
              Antrean & Rekomendasi
            </h2>
            <button
              type="button"
              aria-label="Tutup sidebar"
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-jam-muted transition hover:bg-white/10 hover:text-white"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {selfContributor ? (
            <p className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-jam-muted">
              Identitas antrean Anda:{" "}
              <span className="font-medium text-white">{selfContributor}</span>
            </p>
          ) : null}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-jam-muted">
                Antrean
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {isHost && (
                  <button
                    type="button"
                    onClick={() => setAutoplay(!autoplay)}
                    aria-pressed={autoplay}
                    title="Otomatis putar lagu rekomendasi saat antrean habis"
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition sm:text-xs ${
                      autoplay
                        ? "border-jam-accent/60 bg-jam-accent/15 text-jam-accent"
                        : "border-white/10 bg-black/30 text-jam-muted hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    Autoplay: {autoplay ? "On" : "Off"}
                  </button>
                )}
                {bootLoading && (
                  <span className="text-xs text-jam-muted">Menyinkronkan…</span>
                )}
              </div>
            </div>
            <QueueList
              items={queue}
              currentVideoId={currentVideo?.videoId ?? null}
              loading={bootLoading && queue.length === 0}
              onReorder={handleReorder}
              reorderDisabled={bootLoading}
              scrollable={false}
            />
          </section>

          <RoomRecommendations
            recommendations={recommendations}
            loading={recommendationsLoading}
            error={recommendationsError}
            onAdd={handleAddToQueue}
            autoplayOn={isHost && autoplay}
            disabled={bootLoading}
          />
        </aside>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Tutup sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? "Tutup antrean" : "Buka antrean"}
        aria-expanded={sidebarOpen}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-jam-accent text-black shadow-2xl shadow-black/50 transition hover:bg-jam-accent-hover lg:hidden"
      >
        {sidebarOpen ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : (
          <>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h12" />
            </svg>
            {queue.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-1.5 text-xs font-semibold text-jam-accent ring-2 ring-jam-bg">
                {queue.length}
              </span>
            )}
          </>
        )}
      </button>
    </PageShell>
  );
}
