/** Upload and playback limits per PRD. */

export const MAX_MP3_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_COVER_BYTES = 2 * 1024 * 1024; // 2 MB
export const MP3_MIME = "audio/mpeg";
export const COVER_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

export const DEFAULT_COVER_URL = "/cover-placeholder.svg";

export const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60; // 4 hours

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 350;
export const SEARCH_LIMIT = 10;
