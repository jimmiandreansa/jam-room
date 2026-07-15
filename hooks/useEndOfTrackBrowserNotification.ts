"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { YtPlayerLike } from "@/components/room/YouTubePlayer";
import { YT_STATE_PLAYING } from "@/components/room/YouTubePlayer";

const LS_END_TRACK_NOTIF = "jam:endTrackNotifHostEnabled";
/** Notify when this many seconds of audio remain (host only). */
const SECONDS_BEFORE_END = 7;

function readUserWantsNotif(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_END_TRACK_NOTIF) === "1";
  } catch {
    return false;
  }
}

function writeUserWantsNotif(on: boolean) {
  try {
    if (on) window.localStorage.setItem(LS_END_TRACK_NOTIF, "1");
    else window.localStorage.removeItem(LS_END_TRACK_NOTIF);
  } catch {
    /* ignore */
  }
}

type UseEndOfTrackArgs = {
  videoId: string | null;
  trackTitle: string | null;
  roomIsPlaying: boolean;
  /** Notifications only run for the room host. */
  isHost: boolean;
};

/**
 * Optional desktop notification ~7s before the current track ends (host only),
 * so the host can return to the tab if background playback is flaky.
 */
export function useEndOfTrackBrowserNotification(
  playerRef: RefObject<YtPlayerLike | null>,
  { videoId, trackTitle, roomIsPlaying, isHost }: UseEndOfTrackArgs,
) {
  const notifSupported =
    typeof window !== "undefined" && typeof Notification !== "undefined";

  const [userEnabled, setUserEnabledState] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    if (!isHost) return;
    setUserEnabledState(readUserWantsNotif());
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, [isHost]);

  const requestAndEnable = useCallback(async () => {
    if (!isHost || typeof Notification === "undefined") return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      writeUserWantsNotif(true);
      setUserEnabledState(true);
    }
  }, [isHost]);

  const setUserEnabled = useCallback(
    (on: boolean) => {
      if (!isHost) return;
      writeUserWantsNotif(on);
      setUserEnabledState(on);
    },
    [isHost],
  );

  const warnedVideoIdRef = useRef<string | null>(null);

  useEffect(() => {
    warnedVideoIdRef.current = null;
  }, [videoId]);

  useEffect(() => {
    if (
      !isHost ||
      !notifSupported ||
      permission !== "granted" ||
      !userEnabled ||
      !videoId ||
      !roomIsPlaying
    ) {
      return;
    }

    const tick = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        if (p.getPlayerState() !== YT_STATE_PLAYING) return;
        const dur = p.getDuration();
        const t = p.getCurrentTime();
        if (!(dur > 0 && Number.isFinite(t))) return;
        const remaining = dur - t;
        if (remaining > SECONDS_BEFORE_END || remaining <= 0.2) return;
        if (warnedVideoIdRef.current === videoId) return;
        warnedVideoIdRef.current = videoId;

        const body = trackTitle
          ? `"${trackTitle}" selesai sebentar lagi. Kembali ke tab ini agar lagu berikutnya tidak tertahan.`
          : "Lagu ini selesai sebentar lagi. Kembali ke tab ini agar lagu berikutnya tidak tertahan.";

        const n = new Notification("Lagu hampir habis", {
          body,
          tag: "jam-end-soon-host",
        });
        n.onclick = () => {
          try {
            window.focus();
          } catch {
            /* ignore */
          }
          n.close();
        };
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [
    isHost,
    notifSupported,
    permission,
    userEnabled,
    videoId,
    trackTitle,
    roomIsPlaying,
    playerRef,
  ]);

  return {
    notifSupported,
    permission,
    userEnabled,
    requestAndEnable,
    setUserEnabled,
  };
}
