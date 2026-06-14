"use client";

/** Minimal HTML5 audio surface for hooks (replaces YtPlayerLike). */
export type AudioPlayerLike = {
  play: () => Promise<void>;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPaused: () => boolean;
};

export const AUDIO_STATE_PLAYING = 1;
export const AUDIO_STATE_PAUSED = 2;
