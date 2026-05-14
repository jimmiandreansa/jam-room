-- Run on existing Supabase projects that already have `queue` without `position`.

alter table public.queue add column if not exists position integer;

update public.queue q
set position = s.rn
from (
  select id, row_number() over (partition by room_id order by created_at) as rn
  from public.queue
) s
where q.id = s.id and (q.position is null or q.position = 0);

update public.queue set position = 1 where position is null;

alter table public.queue alter column position set not null;
alter table public.queue alter column position set default 0;

create index if not exists queue_room_position_idx
  on public.queue (room_id, position asc);
