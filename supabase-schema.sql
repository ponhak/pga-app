-- Golf Tournament App — Supabase Schema
-- Run this in your Supabase project's SQL editor

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  group_size int not null default 4,
  notes text,
  created_at timestamptz default now()
);

create table round_players (
  round_id uuid references rounds(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  primary key (round_id, player_id)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  group_number int not null
);

create table group_members (
  group_id uuid references groups(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  primary key (group_id, player_id)
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  strokes int,
  points_earned numeric(5,1),
  rank int,
  unique (round_id, player_id)
);

-- Enable Row Level Security (open access — no auth needed for a private group app)
alter table players enable row level security;
alter table rounds enable row level security;
alter table round_players enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table scores enable row level security;

create policy "Allow all" on players for all using (true) with check (true);
create policy "Allow all" on rounds for all using (true) with check (true);
create policy "Allow all" on round_players for all using (true) with check (true);
create policy "Allow all" on groups for all using (true) with check (true);
create policy "Allow all" on group_members for all using (true) with check (true);
create policy "Allow all" on scores for all using (true) with check (true);
