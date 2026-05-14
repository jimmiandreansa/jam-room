"use client";

import { useCallback, useEffect, useState } from "react";

export type PlaybackMode = "local" | "follow_host";

const storageKey = (roomId: string) => `jam-room-playback-${roomId}`;

function readStoredMode(roomId: string): PlaybackMode {
  if (typeof window === "undefined") return "follow_host";
  try {
    const v = window.localStorage.getItem(storageKey(roomId));
    if (v === "follow_host" || v === "local") return v;
  } catch {
    /* ignore */
  }
  return "follow_host";
}

/**
 * Guest: local vs follow-host (muted sync). Host: always local; toggle hidden.
 */
export function usePlaybackMode(roomId: string, isHost: boolean) {
  const [mode, setModeState] = useState<PlaybackMode>(
    isHost ? "local" : "follow_host",
  );

  useEffect(() => {
    if (isHost) {
      setModeState("local");
      return;
    }
    setModeState(readStoredMode(roomId));
  }, [roomId, isHost]);

  const setMode = useCallback(
    (next: PlaybackMode) => {
      if (isHost) return;
      setModeState(next);
      try {
        window.localStorage.setItem(storageKey(roomId), next);
      } catch {
        /* ignore */
      }
    },
    [roomId, isHost],
  );

  return { mode: isHost ? "local" : mode, setMode } as const;
}
