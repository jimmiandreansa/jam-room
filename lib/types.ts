/** Shared types for Supabase tables and UI state. */

export type Room = {
  id: string;
  name: string;
  created_at: string;
};

export type QueueItem = {
  id: string;
  room_id: string;
  video_id: string;
  title: string;
  thumbnail: string;
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
