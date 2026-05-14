-- Room-wide play/pause sync (run once on existing DB).

alter table public.current_play add column if not exists is_playing boolean not null default true;

update public.current_play set is_playing = true where is_playing is null;
