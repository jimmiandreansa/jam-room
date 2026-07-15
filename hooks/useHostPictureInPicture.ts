"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const LS_HOST_AUTO_PIP = "jam:hostAutoPipEnabled";

const PIP_WIDTH = 480;
const PIP_HEIGHT = 270;

type DocumentPictureInPictureWindow = Window & { document: Document };

type DocumentPictureInPictureApi = {
  window: DocumentPictureInPictureWindow | null;
  requestWindow: (options?: {
    width?: number;
    height?: number;
  }) => Promise<DocumentPictureInPictureWindow>;
};

function getDocumentPiP(): DocumentPictureInPictureApi | null {
  if (typeof window === "undefined") return null;
  const dpp = (
    window as Window & { documentPictureInPicture?: DocumentPictureInPictureApi }
  ).documentPictureInPicture;
  return dpp ?? null;
}

function readUserWantsAutoPip(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_HOST_AUTO_PIP) === "1";
  } catch {
    return false;
  }
}

function writeUserWantsAutoPip(on: boolean) {
  try {
    if (on) window.localStorage.setItem(LS_HOST_AUTO_PIP, "1");
    else window.localStorage.removeItem(LS_HOST_AUTO_PIP);
  } catch {
    /* ignore */
  }
}

const ENTER_PIP_ACTION = "enterpictureinpicture" as MediaSessionAction;

function clearEnterPiPHandler() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler(ENTER_PIP_ACTION, null);
  } catch {
    /* ignore */
  }
}

function setEnterPiPHandler(handler: () => void) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler(ENTER_PIP_ACTION, handler);
  } catch {
    /* enterpictureinpicture not supported */
  }
}
function copyStylesToPipWindow(pipWindow: DocumentPictureInPictureWindow) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.href) {
        const link = pipWindow.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        pipWindow.document.head.appendChild(link);
      } else if (sheet.ownerNode instanceof HTMLStyleElement) {
        pipWindow.document.head.appendChild(sheet.ownerNode.cloneNode(true));
      }
    } catch {
      /* cross-origin stylesheets */
    }
  }
  pipWindow.document.body.style.margin = "0";
  pipWindow.document.body.style.background = "#000";
}

type UseHostPictureInPictureArgs = {
  isHost: boolean;
  containerRef: RefObject<HTMLDivElement>;
  trackTitle: string | null;
  trackThumbnail: string | null;
  isPlaying: boolean;
  hasVideo: boolean;
};

/**
 * Host-only Document Picture-in-Picture: auto on tab switch via Media Session
 * `enterpictureinpicture`, plus manual `enterPiP()` from transport bar.
 */
export function useHostPictureInPicture({
  isHost,
  containerRef,
  trackTitle,
  trackThumbnail,
  isPlaying,
  hasVideo,
}: UseHostPictureInPictureArgs) {
  const supported =
    typeof window !== "undefined" && "documentPictureInPicture" in window;

  const [userEnabled, setUserEnabledState] = useState(false);
  const [isInPiP, setIsInPiP] = useState(false);

  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const pipWindowRef = useRef<DocumentPictureInPictureWindow | null>(null);
  const openingRef = useRef(false);

  useEffect(() => {
    if (!isHost) return;
    setUserEnabledState(readUserWantsAutoPip());
  }, [isHost]);

  const setUserEnabled = useCallback(
    (on: boolean) => {
      if (!isHost) return;
      writeUserWantsAutoPip(on);
      setUserEnabledState(on);
    },
    [isHost],
  );

  const restorePlayer = useCallback(() => {
    const container = containerRef.current;
    const placeholder = placeholderRef.current;

    if (container && placeholder?.parentNode) {
      try {
        placeholder.parentNode.insertBefore(container, placeholder);
        placeholder.remove();
      } catch {
        /* ignore */
      }
    }

    placeholderRef.current = null;
    pipWindowRef.current = null;
    setIsInPiP(false);
    openingRef.current = false;
  }, [containerRef]);

  const openDocumentPiP = useCallback(async () => {
    const dpp = getDocumentPiP();
    const container = containerRef.current;
    if (!dpp || !container || openingRef.current) return;
    if (dpp.window || pipWindowRef.current) return;

    openingRef.current = true;

    try {
      const pipWindow = await dpp.requestWindow({
        width: PIP_WIDTH,
        height: PIP_HEIGHT,
      });

      copyStylesToPipWindow(pipWindow);

      const placeholder = document.createElement("div");
      placeholder.className = container.className;
      if (container.offsetHeight > 0) {
        placeholder.style.minHeight = `${container.offsetHeight}px`;
      }
      placeholder.setAttribute("aria-hidden", "true");
      container.parentNode?.insertBefore(placeholder, container);
      placeholderRef.current = placeholder;

      pipWindow.document.body.appendChild(container);
      pipWindowRef.current = pipWindow;
      setIsInPiP(true);

      pipWindow.addEventListener("pagehide", () => {
        restorePlayer();
      });
    } catch (err) {
      console.warn("[useHostPictureInPicture]", err);
      restorePlayer();
    } finally {
      openingRef.current = false;
    }
  }, [containerRef, restorePlayer]);

  const enterPiP = useCallback(() => {
    void openDocumentPiP();
  }, [openDocumentPiP]);

  useEffect(() => {
    if (!isHost || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    if (!trackTitle) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackTitle,
        artist: "Jam Room",
        artwork: trackThumbnail
          ? [{ src: trackThumbnail, sizes: "480x360", type: "image/jpeg" }]
          : [],
      });
    } catch {
      /* ignore */
    }
  }, [isHost, trackTitle, trackThumbnail]);

  useEffect(() => {
    if (
      !supported ||
      !isHost ||
      !userEnabled ||
      !hasVideo ||
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator)
    ) {
      clearEnterPiPHandler();
      return;
    }

    setEnterPiPHandler(() => {
      if (isPlaying) void openDocumentPiP();
    });

    return () => {
      clearEnterPiPHandler();
    };
  }, [supported, isHost, userEnabled, hasVideo, isPlaying, openDocumentPiP]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && placeholderRef.current) {
        restorePlayer();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [restorePlayer]);

  useEffect(() => {
    return () => {
      restorePlayer();
    };
  }, [restorePlayer]);

  return {
    supported,
    userEnabled,
    setUserEnabled,
    enterPiP,
    isInPiP,
  } as const;
}
