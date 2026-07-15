-- Migration: revert room playback from R2 audio (song_id) back to YouTube (video_id).
-- Run once in the Supabase SQL editor.
--
-- NOTE: This clears existing queue / current_play data because song_id values
-- cannot be mapped to YouTube video_id. The `songs` and `profiles` tables are
-- kept intact so the "My Library" upload feature keeps working.

begin;

-- 1. Clear playback state (cannot map song_id -> video_id).
delete from public.current_play;
delete from public.queue;

-- 2. queue: song_id -> video_id
alter table public.queue drop column if exists song_id;
alter table public.queue add column if not exists video_id text not null;

-- 3. current_play: song_id -> video_id
alter table public.current_play drop column if exists song_id;
alter table public.current_play add column if not exists video_id text not null;

commit;

-- songs / profiles tables are intentionally left untouched.
