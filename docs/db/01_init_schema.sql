create extension if not exists pgcrypto;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date not null,
  start_time time without time zone not null,
  location text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meetings_meeting_date on public.meetings (meeting_date desc);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  role text not null check (role in ('student', 'angel')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rsvps_meeting on public.rsvps (meeting_id, created_at desc);
create index if not exists idx_rsvps_name_search on public.rsvps (meeting_id, lower(name));

create table if not exists public.roster_teams (
  team_name text primary key,
  angel_name text not null,
  team_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roster_teams_order
  on public.roster_teams (team_order asc, team_name asc);

create table if not exists public.roster_team_students (
  team_name text not null references public.roster_teams(team_name) on delete cascade,
  student_name text not null,
  student_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (team_name, student_name)
);

create index if not exists idx_roster_team_students_order
  on public.roster_team_students (team_name, student_order asc, student_name asc);

create table if not exists public.roster_angels (
  angel_name text primary key,
  angel_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_roster_angels_order
  on public.roster_angels (angel_order asc, angel_name asc);
