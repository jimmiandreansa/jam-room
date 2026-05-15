-- Jam Room App — run this in the Supabase SQL editor (or via migration).
-- Enables UUID generation, tables, realtime, and permissive RLS for MVP (anon access).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  video_id text not null,
  title text not null,
  thumbnail text not null,
  added_by_label text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists queue_room_position_idx
  on public.queue (room_id, position asc);

create index if not exists queue_room_id_created_at_idx
  on public.queue (room_id, created_at asc);

create table if not exists public.current_play (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  video_id text not null,
  started_at timestamptz not null default now(),
  is_playing boolean not null default true,
  constraint current_play_room_id_key unique (room_id)
);

-- Filtered Realtime subscriptions need full row payloads on updates/deletes.
alter table public.rooms replica identity full;
alter table public.queue replica identity full;
alter table public.current_play replica identity full;

-- ---------------------------------------------------------------------------
-- Realtime: replicate changes to connected clients
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.queue;
alter publication supabase_realtime add table public.current_play;

-- If a table was already in the publication, you may see an error — safe to ignore.

-- ---------------------------------------------------------------------------
-- Row Level Security (MVP: open read/write for anon — tighten before production)
-- ---------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.queue enable row level security;
alter table public.current_play enable row level security;

create policy "rooms_mvp_all" on public.rooms for all using (true) with check (true);
create policy "queue_mvp_all" on public.queue for all using (true) with check (true);
create policy "current_play_mvp_all" on public.current_play for all using (true) with check (true);
