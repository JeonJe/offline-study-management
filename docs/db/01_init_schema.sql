create extension if not exists pgcrypto;

create table if not exists public.operating_units (
  slug text primary key,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_operating_units_single_default
  on public.operating_units (is_default)
  where is_default;

insert into public.operating_units (slug, name, is_default)
values ('3기', '3기', true)
on conflict (slug)
do update set
  name = coalesce(nullif(public.operating_units.name, ''), excluded.name),
  is_default = true,
  updated_at = now();

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date not null,
  start_time time without time zone not null,
  location text not null,
  description text,
  leaders text[] not null default '{}'::text[],
  password_hash text,
  capacity integer,
  constraint chk_meetings_capacity check (capacity is null or capacity >= 0),
  operating_unit_slug text not null default '3기',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meetings_meeting_date
  on public.meetings (meeting_date desc, start_time desc);

create index if not exists idx_meetings_operating_unit
  on public.meetings (operating_unit_slug);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  role text not null check (role in ('student', 'angel', 'supporter', 'buddy', 'mentor', 'manager')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rsvps_meeting_created
  on public.rsvps (meeting_id, created_at desc);

create index if not exists idx_rsvps_meeting_name
  on public.rsvps (meeting_id, lower(name));

create table if not exists public.afterparties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time without time zone not null,
  location text not null,
  description text,
  settlement_manager text,
  settlement_account text,
  password_hash text,
  operating_unit_slug text not null default '3기',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_afterparties_event_date
  on public.afterparties (event_date desc, start_time desc);

create index if not exists idx_afterparties_operating_unit
  on public.afterparties (operating_unit_slug);

create table if not exists public.afterparty_participants (
  id uuid primary key default gen_random_uuid(),
  afterparty_id uuid not null references public.afterparties(id) on delete cascade,
  name text not null,
  role text not null default 'student' check (role in ('student', 'angel', 'supporter', 'buddy', 'mentor', 'manager')),
  is_settled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_afterparty_participants_created
  on public.afterparty_participants (afterparty_id, created_at desc);

create index if not exists idx_afterparty_participants_name
  on public.afterparty_participants (afterparty_id, lower(name));

create unique index if not exists idx_afterparty_participants_unique_name
  on public.afterparty_participants (afterparty_id, lower(name));

create table if not exists public.afterparty_settlements (
  id uuid primary key default gen_random_uuid(),
  afterparty_id uuid not null references public.afterparties(id) on delete cascade,
  title text not null,
  settlement_manager text,
  settlement_account text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_afterparty_settlements_order
  on public.afterparty_settlements (afterparty_id, sort_order asc, created_at asc);

create table if not exists public.afterparty_settlement_participants (
  settlement_id uuid not null references public.afterparty_settlements(id) on delete cascade,
  participant_id uuid not null references public.afterparty_participants(id) on delete cascade,
  is_settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (settlement_id, participant_id)
);

create index if not exists idx_afterparty_settlement_participants_settlement
  on public.afterparty_settlement_participants (settlement_id, created_at asc);

create index if not exists idx_afterparty_settlement_participants_participant
  on public.afterparty_settlement_participants (participant_id);

create table if not exists public.member_teams (
  team_name text primary key,
  angel_name text not null,
  angel_names text[] not null default '{}'::text[],
  team_order integer not null default 0,
  operating_unit_slug text not null default '3기',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_teams_order
  on public.member_teams (team_order asc, team_name asc);

create index if not exists idx_member_teams_operating_unit
  on public.member_teams (operating_unit_slug);

create table if not exists public.member_team_members (
  team_name text not null references public.member_teams(team_name) on delete cascade,
  member_name text not null,
  member_order integer not null default 0,
  operating_unit_slug text not null default '3기',
  created_at timestamptz not null default now(),
  primary key (team_name, member_name)
);

create index if not exists idx_member_team_members_order
  on public.member_team_members (team_name, member_order asc, member_name asc);

create index if not exists idx_member_team_members_operating_unit
  on public.member_team_members (operating_unit_slug);

create table if not exists public.member_angels (
  angel_name text primary key,
  angel_order integer not null default 0,
  operating_unit_slug text not null default '3기',
  created_at timestamptz not null default now()
);

create index if not exists idx_member_angels_order
  on public.member_angels (angel_order asc, angel_name asc);

create index if not exists idx_member_angels_operating_unit
  on public.member_angels (operating_unit_slug);

create table if not exists public.member_special_roles (
  role text not null check (role in ('supporter', 'buddy', 'mentor', 'manager')),
  member_name text not null,
  member_order integer not null default 0,
  operating_unit_slug text not null default '3기',
  created_at timestamptz not null default now(),
  primary key (role, member_name)
);

create index if not exists idx_member_special_roles_order
  on public.member_special_roles (role, member_order asc, member_name asc);

create index if not exists idx_member_special_roles_operating_unit
  on public.member_special_roles (operating_unit_slug);

create table if not exists public.weekly_report_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt text not null,
  sections jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  operating_unit_slug text not null default '3기',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_weekly_report_templates_created
  on public.weekly_report_templates (created_at desc);

create index if not exists idx_weekly_report_templates_operating_unit
  on public.weekly_report_templates (operating_unit_slug);

create table if not exists public.weekly_report_cycles (
  id uuid primary key default gen_random_uuid(),
  template_id uuid,
  title text not null,
  week_label text not null,
  start_date date,
  due_date date,
  prompt text,
  status text not null default 'open' check (status in ('open', 'closed')),
  operating_unit_slug text not null default '3기',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_weekly_report_cycles_status_created
  on public.weekly_report_cycles (status, created_at desc);

create index if not exists idx_weekly_report_cycles_operating_unit
  on public.weekly_report_cycles (operating_unit_slug);

create table if not exists public.angel_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.weekly_report_cycles(id) on delete cascade,
  angel_name text not null,
  team_name text not null,
  summary text not null,
  notes text,
  requests text,
  action_items text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, angel_name, team_name)
);

create index if not exists idx_angel_weekly_reports_cycle
  on public.angel_weekly_reports (cycle_id, updated_at desc);

create table if not exists public.weekly_report_comments (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.angel_weekly_reports(id) on delete cascade,
  author_role   text not null check (author_role in ('admin', 'angel', 'leader')),
  author_label  text not null,
  body          text not null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_weekly_report_comments_report
  on public.weekly_report_comments (report_id, created_at asc)
  where deleted_at is null;
