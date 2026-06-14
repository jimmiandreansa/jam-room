"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "jam:local-volume-v1";

function readStoredVolume(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 1;
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  } catch {
    /* ignore */
  }
  return 1;
}

export function useLocalVolume() {
  const [volume, setVolumeState] = useState(1);

  useEffect(() => {
    setVolumeState(readStoredVolume());
  }, []);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    setVolumeState(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  return { volume, setVolume } as const;
}
