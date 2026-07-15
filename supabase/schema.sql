-- Jam Room App — run this in the Supabase SQL editor (or via migration).
-- Enables UUID generation, tables, realtime, and permissive RLS for jam MVP (anon access).
-- Room playback uses YouTube (video_id). Songs catalog (R2 audio) + Google Auth
-- power the standalone "My Library" upload feature.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  artist text,
  duration_seconds integer,
  file_key text not null,
  file_url text not null,
  cover_key text,
  cover_url text,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists songs_user_id_idx on public.songs (user_id);
create index if not exists songs_created_at_idx on public.songs (created_at desc);
create index if not exists songs_title_trgm_idx on public.songs using gin (title gin_trgm_ops);
create index if not exists songs_artist_trgm_idx on public.songs using gin (artist gin_trgm_ops);

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
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.queue enable row level security;
alter table public.current_play enable row level security;
alter table public.songs enable row level security;
alter table public.profiles enable row level security;

-- Jam MVP: open read/write for anon on room tables (tighten before production).
create policy "rooms_mvp_all" on public.rooms for all using (true) with check (true);
create policy "queue_mvp_all" on public.queue for all using (true) with check (true);
create policy "current_play_mvp_all" on public.current_play for all using (true) with check (true);

-- Songs: public read; authenticated users manage own rows.
create policy "songs_public_read" on public.songs for select using (true);
create policy "songs_insert_own" on public.songs for insert with check (auth.uid() = user_id);
create policy "songs_update_own" on public.songs for update using (auth.uid() = user_id);
create policy "songs_delete_own" on public.songs for delete using (auth.uid() = user_id);

create policy "profiles_public_read" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on sign-up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
