"use client";

import { Button } from "@/components/ui/Button";

type PlaybackTransportProps = {
  hasVideo: boolean;
  /** Room-wide playing state from `current_play.is_playing`. */
  roomIsPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  showPipButton?: boolean;
  pipSupported?: boolean;
  isInPiP?: boolean;
  onEnterPip?: () => void;
};

const iconClass = "h-8 w-8 sm:h-9 sm:w-9";

function IconPlay() {
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5.5v13l11.5-6.5L8 5.5z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7 6h4v12H7V6zm6 0h4v12h-4V6z" />
    </svg>
  );
}

function IconSkipNext() {
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 18V6l9 6-9 6zm11-12h2v12h-2V6z" />
    </svg>
  );
}

function IconPictureInPicture() {
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M19 7h-8v6h8V7zm0-2a2 2 0 012 2v6a2 2 0 01-2 2h-8a2 2 0 01-2-2V7a2 2 0 012-2h8zM5 17h6v2H5a2 2 0 01-2-2V5a2 2 0 012-2h2v2H5v12z" />
    </svg>
  );
}

export function PlaybackTransport({
  hasVideo,
  roomIsPlaying,
  onPlayPause,
  onNext,
  nextDisabled,
  showPipButton,
  pipSupported,
  isInPiP,
  onEnterPip,
}: PlaybackTransportProps) {
  return (
    <div className="flex items-center justify-center gap-4 pt-1 sm:gap-5 sm:pt-2">
      <Button
        type="button"
        className="flex h-10 w-10 items-center justify-center overflow-visible rounded-full p-0 sm:h-11 sm:w-11"
        disabled={!hasVideo}
        onClick={onPlayPause}
        title={roomIsPlaying ? "Jeda (semua perangkat)" : "Putar (semua perangkat)"}
        aria-label={roomIsPlaying ? "Jeda" : "Putar"}
      >
        <span className="pointer-events-none flex scale-110 items-center justify-center sm:scale-[1.12]">
          {roomIsPlaying ? <IconPause /> : <IconPlay />}
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="flex h-10 w-10 items-center justify-center overflow-visible rounded-full border border-white/15 p-0 text-white hover:bg-white/10 sm:h-11 sm:w-11"
        disabled={!hasVideo || nextDisabled}
        onClick={onNext}
        title="Lagu berikutnya"
        aria-label="Berikutnya"
      >
        <span className="pointer-events-none flex scale-110 items-center justify-center sm:scale-[1.12]">
          <IconSkipNext />
        </span>
      </Button>
      {showPipButton && (
        <Button
          type="button"
          variant="ghost"
          className={`flex h-10 w-10 items-center justify-center overflow-visible rounded-full border p-0 sm:h-11 sm:w-11 ${
            isInPiP
              ? "border-jam-accent text-jam-accent"
              : "border-white/15 text-white hover:bg-white/10"
          }`}
          disabled={!hasVideo || !pipSupported}
          onClick={onEnterPip}
          title="Picture-in-Picture (mini player)"
          aria-label="Picture-in-Picture"
        >
          <span className="pointer-events-none flex scale-110 items-center justify-center sm:scale-[1.12]">
            <IconPictureInPicture />
          </span>
        </Button>
      )}
    </div>
  );
}
