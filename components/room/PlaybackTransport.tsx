"use client";

import { Button } from "@/components/ui/Button";

type PlaybackTransportProps = {
  hasVideo: boolean;
  /** Room-wide playing state from `current_play.is_playing`. */
  roomIsPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
};

function IconPlay() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function IconSkipNext() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
}

export function PlaybackTransport({
  hasVideo,
  roomIsPlaying,
  onPlayPause,
  onNext,
  nextDisabled,
}: PlaybackTransportProps) {
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      <Button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-full p-0"
        disabled={!hasVideo}
        onClick={onPlayPause}
        title={roomIsPlaying ? "Jeda (semua perangkat)" : "Putar (semua perangkat)"}
        aria-label={roomIsPlaying ? "Jeda" : "Putar"}
      >
        {roomIsPlaying ? <IconPause /> : <IconPlay />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 p-0 text-white hover:bg-white/10"
        disabled={!hasVideo || nextDisabled}
        onClick={onNext}
        title="Lagu berikutnya"
        aria-label="Berikutnya"
      >
        <IconSkipNext />
      </Button>
    </div>
  );
}
