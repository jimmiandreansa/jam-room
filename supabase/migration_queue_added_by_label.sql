-- Optional: run in Supabase SQL editor if your project was created from an older schema.
alter table public.queue
  add column if not exists added_by_label text;

comment on column public.queue.added_by_label is
  'Client-generated display tag (emoji + coined label) for who queued the track.';
