-- Multiplayer sessions: two drivers share a seed and a run of stages, and
-- nobody moves on until both have finished each one. Written only by the
-- API routes with the service-role key; row-level security stays on with no
-- policies, so the public anon key can neither read nor write these tables.
create table if not exists public.sessions (
  id text primary key check (id ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  seed bigint not null check (seed >= 0 and seed < 4294967296),
  stage_count smallint not null check (stage_count in (3, 6, 9)),
  car_id text not null,
  created_at timestamptz not null default now()
);

-- One row per seat. The (session, seat) key is what stops a third driver:
-- a second insert for a taken seat fails with 409.
create table if not exists public.session_players (
  session_id text not null references public.sessions (id) on delete cascade,
  seat smallint not null check (seat between 0 and 1),
  player_id text not null,
  name text not null check (char_length(name) between 1 and 24),
  token_hash text not null,
  joined_at timestamptz not null default now(),
  primary key (session_id, seat),
  unique (session_id, player_id)
);

-- One counted run per driver per stage; `time` is null for a retirement.
-- The API checks player_id against the seats; there is deliberately no
-- foreign key to session_players, which would make this table look like a
-- many-to-many junction to PostgREST and the sessions -> session_players
-- embed ambiguous.
create table if not exists public.session_results (
  session_id text not null references public.sessions (id) on delete cascade,
  stage_index smallint not null check (stage_index >= 0),
  player_id text not null,
  time double precision check (time is null or time > 0),
  splits jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  primary key (session_id, stage_index, player_id)
);

alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.session_results enable row level security;

comment on table public.sessions is 'Micro Rally multiplayer sessions, keyed by Session ID. Server-only via the service role.';
comment on table public.session_players is 'Seats in a session; token_hash is the SHA-256 of the seat''s secret.';
comment on table public.session_results is 'Each driver''s counted run per session stage.';
