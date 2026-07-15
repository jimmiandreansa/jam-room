"use client";

import { useCallback, useEffect, useState } from "react";

const storageKey = (roomId: string) => `jam-room-autoplay-${roomId}`;

function readStored(roomId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(storageKey(roomId));
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true; // default on
}

/**
 * Host-only autoplay toggle (persisted per room in localStorage). Only the host
 * drives autoplay, so guests always read `false`.
 */
export function useAutoplay(roomId: string, isHost: boolean) {
  const [autoplay, setAutoplayState] = useState(true);

  useEffect(() => {
    if (!isHost) {
      setAutoplayState(false);
      return;
    }
    setAutoplayState(readStored(roomId));
  }, [roomId, isHost]);

  const setAutoplay = useCallback(
    (next: boolean) => {
      if (!isHost) return;
      setAutoplayState(next);
      try {
        window.localStorage.setItem(storageKey(roomId), next ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [roomId, isHost],
  );

  return { autoplay: isHost ? autoplay : false, setAutoplay } as const;
}
