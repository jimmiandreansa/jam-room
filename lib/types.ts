/** Shared types for Supabase tables and UI state. */

export type Room = {
  id: string;
  name: string;
  created_at: string;
};

export type Song = {
  id: string;
  user_id: string;
  title: string;
  artist: string | null;
  duration_seconds: number | null;
  file_key: string;
  file_url: string;
  cover_key: string | null;
  cover_url: string | null;
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export type QueueItem = {
  id: string;
  room_id: string;
  video_id: string;
  title: string;
  thumbnail: string;
  /** Client-generated tag, e.g. "🦦 Lumivex" — who queued the track. */
  added_by_label?: string | null;
  position: number;
  created_at: string;
};

export type CurrentPlay = {
  id: string;
  room_id: string;
  video_id: string;
  started_at: string;
  /** When false, all clients should pause the YouTube player (room-wide). */
  is_playing?: boolean;
};

export type YoutubeSearchHit = {
  videoId: string;
  title: string;
  thumbnail: string;
};

export type RoomMember = {
  presenceKey: string;
  kind: "authenticated" | "anonymous";
  displayName: string;
  avatarUrl: string | null;
  anonymousEmoji: string | null;
  isHost: boolean;
};
