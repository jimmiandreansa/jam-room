"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { AudioPlayerLike } from "@/lib/audioPlayer";
import { DEFAULT_COVER_URL } from "@/lib/songConstants";

type AudioPlayerProps = {
  songId: string | null;
  audioUrl: string | null;
  title: string | null;
  artist: string | null;
  coverUrl: string | null;
  muted?: boolean;
  roomIsPlaying?: boolean;
  initialSeekSeconds?: number | null;
  volume?: number;
  onEnd?: () => void;
  onError?: () => void;
  onPlayerReady?: (player: AudioPlayerLike) => void;
  onPlayerChange?: (player: AudioPlayerLike | null) => void;
};

function wrapAudio(el: HTMLAudioElement): AudioPlayerLike {
  return {
    play: () => el.play(),
    pause: () => {
      el.pause();
    },
    seekTo: (seconds: number) => {
      if (Number.isFinite(seconds)) el.currentTime = seconds;
    },
    getCurrentTime: () => el.currentTime,
    getDuration: () => el.duration || 0,
    isPaused: () => el.paused,
  };
}

export function AudioPlayer({
  songId,
  audioUrl,
  title,
  artist,
  coverUrl,
  muted,
  roomIsPlaying = true,
  initialSeekSeconds,
  volume = 1,
  onEnd,
  onError,
  onPlayerReady,
  onPlayerChange,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
    onPlayerChange?.(null);
  }, [songId, onPlayerChange]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = Boolean(muted);
  }, [muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !readyRef.current) return;
    if (roomIsPlaying) void el.play().catch(() => {});
    else el.pause();
  }, [roomIsPlaying, songId]);

  if (!songId || !audioUrl) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/40 text-sm text-jam-muted">
        Belum ada yang diputar — tambahkan lagu atau tunggu antrean.
      </div>
    );
  }

  const cover = coverUrl || DEFAULT_COVER_URL;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg shadow-black/40">
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-jam-surface/80 to-black px-6 py-8">
        <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-black shadow-xl sm:h-48 sm:w-48">
          <Image
            src={cover}
            alt=""
            fill
            className="object-cover"
            sizes="192px"
            unoptimized
          />
        </div>
        <div className="max-w-full text-center">
          <p className="truncate text-lg font-semibold text-white sm:text-xl">
            {title ?? "Unknown track"}
          </p>
          {artist ? (
            <p className="mt-1 truncate text-sm text-jam-muted">{artist}</p>
          ) : null}
        </div>
      </div>
      <audio
        key={songId}
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        className="sr-only"
        onLoadedMetadata={() => {
          const el = audioRef.current;
          if (!el) return;
          const dur = el.duration;
          if (
            initialSeekSeconds != null &&
            initialSeekSeconds > 0 &&
            Number.isFinite(dur) &&
            dur > 0
          ) {
            el.currentTime = Math.min(
              Math.max(0, initialSeekSeconds),
              Math.max(0, dur - 0.25),
            );
          }
          el.muted = Boolean(muted);
          el.volume = Math.min(1, Math.max(0, volume));
          if (roomIsPlaying) void el.play().catch(() => {});
          else el.pause();
          readyRef.current = true;
          const player = wrapAudio(el);
          onPlayerReady?.(player);
          onPlayerChange?.(player);
        }}
        onEnded={() => onEnd?.()}
        onError={() => {
          onPlayerChange?.(null);
          onError?.();
        }}
      />
      {muted && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 bg-black/50 px-3 py-2 text-center text-xs text-white/90">
          Audio disinkronkan (bisu di perangkat ini) — dengarkan dari speaker
          host jika berkumpul fisik.
        </div>
      )}
    </div>
  );
}
