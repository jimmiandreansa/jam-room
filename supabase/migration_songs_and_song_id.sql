-- Jam Room App — pivot: songs library + song_id (replaces video_id).
-- Run once in Supabase SQL Editor after existing schema migrations.
-- Breaking change: drops video_id from queue and current_play.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Profiles (optional, synced from Google OAuth)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
  on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Songs catalog (metadata; audio files in Cloudflare R2)
-- ---------------------------------------------------------------------------

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

alter table public.songs enable row level security;

drop policy if exists "songs_public_read" on public.songs;
create policy "songs_public_read"
  on public.songs for select using (true);

drop policy if exists "songs_insert_own" on public.songs;
create policy "songs_insert_own"
  on public.songs for insert with check (auth.uid() = user_id);

drop policy if exists "songs_update_own" on public.songs;
create policy "songs_update_own"
  on public.songs for update using (auth.uid() = user_id);

drop policy if exists "songs_delete_own" on public.songs;
create policy "songs_delete_own"
  on public.songs for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Queue: video_id → song_id
-- ---------------------------------------------------------------------------

alter table public.queue drop column if exists video_id;
alter table public.queue add column if not exists song_id uuid references public.songs (id) on delete cascade;

-- New installs / empty queue: song_id can be null until populated; enforce NOT NULL after backfill if needed.
-- For MVP pivot with no legacy data, make NOT NULL:
do $$
begin
  if not exists (
    select 1 from public.queue where song_id is null limit 1
  ) then
    alter table public.queue alter column song_id set not null;
  end if;
exception
  when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- current_play: video_id → song_id
-- ---------------------------------------------------------------------------

alter table public.current_play drop column if exists video_id;
alter table public.current_play add column if not exists song_id uuid references public.songs (id) on delete set null;

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
