-- Online saves: one row per Game ID. The API route writes with the service
-- role key; row-level security stays on with no policies, so the public anon
-- key cannot read or write saves.
create table if not exists public.games (
  id text primary key check (id ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  save jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

comment on table public.games is 'Micro Rally saves, keyed by Game ID. Server-only via the service role.';
