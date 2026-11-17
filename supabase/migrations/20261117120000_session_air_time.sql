-- Multiplayer air-time points: each counted run carries the seconds its car
-- spent in the air over the stage's jumps. Runs counted before this read 0.

alter table public.session_results
  add column if not exists air_time real not null default 0
  check (air_time >= 0);
