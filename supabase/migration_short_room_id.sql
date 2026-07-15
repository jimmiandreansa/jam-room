-- Migration: switch room IDs from UUID to short 4-char codes (a-z A-Z 0-9).
-- BREAKING: changes rooms.id primary key type. Resets room data (rooms/queue/current_play).
-- Run this in the Supabase SQL editor.

-- 1. Drop FKs that depend on rooms.id / room_id types.
alter table public.queue drop constraint if exists queue_room_id_fkey;
alter table public.current_play drop constraint if exists current_play_room_id_fkey;

-- 2. Reset room data (old UUID ids are incompatible with the new 4-char format).
truncate table public.current_play, public.queue, public.rooms cascade;

-- 3. Change column types to text; codes are generated client-side (no default).
alter table public.rooms alter column id drop default;
alter table public.rooms alter column id type text using id::text;
alter table public.queue alter column room_id type text using room_id::text;
alter table public.current_play alter column room_id type text using room_id::text;

-- 4. Enforce the 4-char alphanumeric format.
alter table public.rooms drop constraint if exists rooms_id_format;
alter table public.rooms
  add constraint rooms_id_format check (id ~ '^[A-Za-z0-9]{4}$');

-- 5. Recreate foreign keys.
alter table public.queue
  add constraint queue_room_id_fkey foreign key (room_id)
  references public.rooms (id) on delete cascade;
alter table public.current_play
  add constraint current_play_room_id_fkey foreign key (room_id)
  references public.rooms (id) on delete cascade;
