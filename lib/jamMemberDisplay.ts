import type { User } from "@supabase/supabase-js";

const PRESENCE_KEY_STORAGE = "jam:presence-key-v1";

export type RoomPresenceMeta = {
  kind: "authenticated" | "anonymous";
  display_name: string;
  avatar_url: string | null;
  anonymous_emoji: string | null;
  is_host: boolean;
};

export function getOrCreatePresenceKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(PRESENCE_KEY_STORAGE);
    if (existing && existing.length >= 8) return existing;
  } catch {
    /* ignore */
  }
  const key =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    window.localStorage.setItem(PRESENCE_KEY_STORAGE, key);
  } catch {
    /* ignore */
  }
  return key;
}

export function parseContributorLabel(label: string): {
  emoji: string;
  name: string;
} {
  const trimmed = label.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx > 0) {
    return {
      emoji: trimmed.slice(0, spaceIdx),
      name: trimmed.slice(spaceIdx + 1).trim(),
    };
  }
  return { emoji: "🎵", name: trimmed || "Guest" };
}

export function displayNameFromUser(user: User): string {
  const meta = user.user_metadata as Record<string, unknown>;
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email?.split("@")[0] ||
    "User";
  return name;
}

export function avatarFromUser(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown>;
  if (typeof meta.avatar_url === "string" && meta.avatar_url) return meta.avatar_url;
  if (typeof meta.picture === "string" && meta.picture) return meta.picture;
  return null;
}

export function buildPresenceMeta(
  user: User | null,
  anonymousLabel: string,
  isHost: boolean,
): RoomPresenceMeta {
  if (user) {
    return {
      kind: "authenticated",
      display_name: displayNameFromUser(user),
      avatar_url: avatarFromUser(user),
      anonymous_emoji: null,
      is_host: isHost,
    };
  }
  const { emoji, name } = parseContributorLabel(anonymousLabel);
  return {
    kind: "anonymous",
    display_name: name,
    avatar_url: null,
    anonymous_emoji: emoji,
    is_host: isHost,
  };
}
