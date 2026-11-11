-- Multiplayer, part two: each driver picks their own car, and drivers on the
-- same stage see each other's car live. Like the other session tables these
-- are written only by the API routes with the service-role key; row-level
-- security stays on with no policies.

-- The car each driver picked when they created or joined the session. Seats
-- taken before this column existed keep null and drive sessions.car_id.
alter table public.session_players add column if not exists car_id text;

-- Each driver's latest second of positions while they drive a stage,
-- overwritten a few times a second and worthless after a few seconds:
-- unlogged, so the writes skip the WAL (a crash just empties it).
create unlogged table if not exists public.session_live (
  session_id text not null references public.sessions (id) on delete cascade,
  player_id text not null,
  stage_index smallint not null check (stage_index >= 0),
  run text not null check (char_length(run) between 1 and 32),
  samples jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

alter table public.session_live enable row level security;

comment on table public.session_live is 'Micro Rally: each session driver''s latest live window. Ephemeral; server-only via the service role.';

-- One round trip per exchange: store this driver's window, answer the other
-- driver's if it is fresh. The API checks the seat's token before calling.
create or replace function public.session_live_exchange(
  p_session text,
  p_player text,
  p_stage smallint,
  p_run text,
  p_samples jsonb
) returns setof public.session_live
language sql
volatile
set search_path = public
as $$
  insert into public.session_live as l (session_id, player_id, stage_index, run, samples, updated_at)
  values (p_session, p_player, p_stage, p_run, p_samples, now())
  on conflict (session_id, player_id) do update
    set stage_index = excluded.stage_index,
        run = excluded.run,
        samples = excluded.samples,
        updated_at = excluded.updated_at;

  select l.*
  from public.session_live l
  where l.session_id = p_session
    and l.player_id <> p_player
    and l.updated_at > now() - interval '4 seconds'
  limit 1;
$$;

revoke all on function public.session_live_exchange(text, text, smallint, text, jsonb) from public;
revoke all on function public.session_live_exchange(text, text, smallint, text, jsonb) from anon, authenticated;
grant execute on function public.session_live_exchange(text, text, smallint, text, jsonb) to service_role;
