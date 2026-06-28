-- Fantasy Knockout Supabase schema
-- Run this once in Supabase SQL Editor.

create table if not exists public.players (
  id text primary key,
  name text not null unique,
  pin_salt text not null,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fixtures (
  id text primary key,
  round text not null,
  home text not null,
  away text not null,
  kickoff text,
  venue text,
  locked boolean not null default false,
  actual_h integer,
  actual_a integer
);

create table if not exists public.predictions (
  player_id text not null references public.players(id) on delete cascade,
  fixture_id text not null references public.fixtures(id) on delete cascade,
  h integer not null,
  a integer not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, fixture_id)
);

create table if not exists public.sessions (
  token text primary key,
  player_id text not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Keep the database private from browser/anon access.
-- Your Render backend uses the service_role key, which can access these tables.
alter table public.players enable row level security;
alter table public.fixtures enable row level security;
alter table public.predictions enable row level security;
alter table public.sessions enable row level security;
