-- Multiplayer, part three: the host ticks the stage types a session cycles
-- through, and each driver picks their car in the lobby, once, instead of
-- the host picking one car for both.

-- The ticked stage types, in the picker's order. Null on sessions from
-- before hosts picked types: those follow the career calendar.
alter table public.sessions add column if not exists stage_types text[];

-- New sessions have no shared car; their drivers' cars live on
-- session_players.car_id (added in 20261111180000), set once from the lobby.
-- Older sessions keep theirs as the fallback for seats without one.
alter table public.sessions alter column car_id drop not null;
