"use client";

import type { RefObject } from "react";
import YouTube, { type YouTubeProps } from "react-youtube";

/** Minimal YT IFrame API surface we use (avoids global @types/youtube). */
export type YtPlayerLike = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  mute: () => void;
  unMute: () => void;
  getIframe?: () => HTMLIFrameElement;
};

export const YT_STATE_PLAYING = 1;
export const YT_STATE_PAUSED = 2;

type YouTubePlayerProps = {
  videoId: string | null;
  playbackKey: string;
  muted?: boolean;
  /** Room-wide: when false, pause after load and on sync. */
  roomIsPlaying?: boolean;
  /** Wall-clock sync: seek after load (seconds from track start). */
  initialSeekSeconds?: number | null;
  /** Host PiP: element moved into Document Picture-in-Picture window. */
  containerRef?: RefObject<HTMLDivElement>;
  onEnd?: YouTubeProps["onEnd"];
  onPlayerReady?: (player: YtPlayerLike) => void;
  onPlayerChange?: (player: YtPlayerLike | null) => void;
};

/** Wraps react-youtube (client-only component — do not import from RSC). */
export function YouTubePlayer({
  videoId,
  playbackKey,
  muted,
  roomIsPlaying = true,
  initialSeekSeconds,
  containerRef,
  onEnd,
  onPlayerReady,
  onPlayerChange,
}: YouTubePlayerProps) {
  if (!videoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/40 text-sm text-jam-muted">
        Belum ada yang diputar — tambahkan lagu atau tunggu antrean.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg shadow-black/40"
    >
      <YouTube
        key={playbackKey}
        videoId={videoId}
        className="aspect-video w-full"
        opts={{
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            mute: muted ? 1 : 0,
          },
        }}
        onReady={(e: Parameters<NonNullable<YouTubeProps["onReady"]>>[0]) => {
          const p = e.target as YtPlayerLike;
          const iframe = p.getIframe?.();
          if (iframe) {
            iframe.allow =
              "picture-in-picture; autoplay; encrypted-media; fullscreen";
          }
          const dur = p.getDuration();
          if (
            initialSeekSeconds != null &&
            initialSeekSeconds > 0 &&
            Number.isFinite(dur) &&
            dur > 0
          ) {
            const safe = Math.min(
              Math.max(0, initialSeekSeconds),
              Math.max(0, dur - 0.5),
            );
            p.seekTo(safe, true);
          }
          if (muted) p.mute();
          else p.unMute();
          if (!roomIsPlaying) p.pauseVideo();
          else p.playVideo();
          onPlayerReady?.(p);
          onPlayerChange?.(p);
        }}
        onEnd={onEnd}
        onError={() => onPlayerChange?.(null)}
        iframeClassName="h-full w-full min-h-[200px] sm:min-h-[320px]"
      />
      {muted && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 bg-black/50 px-3 py-2 text-center text-xs text-white/90">
          Video disinkronkan (bisu di perangkat ini) — dengarkan audio dari
          speaker host jika berkumpul fisik.
        </div>
      )}
    </div>
  );
}
