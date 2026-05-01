import { randomUUID } from "node:crypto";
import { query, withTransaction } from "@/lib/db";
import {
  DEFAULT_OPERATING_UNIT_SLUG,
  ensureOperatingUnitColumn,
  ensureOperatingUnitSchema,
} from "@/lib/operating-unit-store";

export type TeamMemberEntry = {
  id: string;
  name: string;
  order: number;
};

export type TeamMemberGroup = {
  teamName: string;
  members: string[];
  memberEntries?: TeamMemberEntry[];
  angels: string[];
};

export type SpecialParticipantRole =
  | "supporter"
  | "buddy"
  | "mentor"
  | "manager";

export const SPECIAL_PARTICIPANT_ROLES: SpecialParticipantRole[] = [
  "supporter",
  "buddy",
  "mentor",
  "manager",
];

export type SpecialRoleDirectory = Record<SpecialParticipantRole, string[]>;

export type MemberPreset = {
  teamGroups: TeamMemberGroup[];
  fixedAngels: string[];
  specialRoles: SpecialRoleDirectory;
  source: "db";
};

type DbTeamRow = {
  teamName: string;
  angelNames: string[] | null;
  memberId: string | null;
  memberName: string | null;
  memberOrder: number | null;
};

type DbAngelRow = {
  angelName: string;
};

type DbSpecialRoleRow = {
  role: SpecialParticipantRole;
  memberName: string;
};

type CountRow = {
  count: string;
};

type LegacyTableRow = {
  name: string | null;
};

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;
let legacyMigrationChecked = false;
const runtimeMigrationsEnabled =
  process.env.DB_RUNTIME_MIGRATIONS === "1" ||
  process.env.DB_RUNTIME_MIGRATIONS === "true";

function normalizeTeamGroups(groups: TeamMemberGroup[]): TeamMemberGroup[] {
  const seenTeams = new Set<string>();
  const normalized: TeamMemberGroup[] = [];

  for (const group of groups) {
    const teamName = group.teamName.trim();
    const angels = normalizeAngels(group.angels ?? []).slice(0, 2);
    if (!teamName || angels.length === 0 || seenTeams.has(teamName)) continue;

    seenTeams.add(teamName);

    const seenMemberIds = new Set<string>();
    const memberEntries: TeamMemberEntry[] = [];
    const rawEntries =
      group.memberEntries && group.memberEntries.length > 0
        ? group.memberEntries
        : group.members.map((name, order) => ({ id: randomUUID(), name, order }));

    for (const [fallbackOrder, entry] of rawEntries.entries()) {
      const member = entry.name.trim();
      const memberId = entry.id.trim() || randomUUID();
      if (!member || seenMemberIds.has(memberId)) continue;
      seenMemberIds.add(memberId);
      memberEntries.push({
        id: memberId,
        name: member,
        order: Number.isFinite(entry.order) ? entry.order : fallbackOrder,
      });
    }

    memberEntries.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ko"));
    normalized.push({
      teamName,
      angels,
      memberEntries,
      members: memberEntries.map((member) => member.name),
    });
  }

  return normalized;
}

function normalizeAngels(angels: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const angelName of angels) {
    const angel = angelName.trim();
    if (!angel || seen.has(angel)) continue;
    seen.add(angel);
    normalized.push(angel);
  }
  return normalized;
}

function createEmptySpecialRoleDirectory(): SpecialRoleDirectory {
  return {
    supporter: [],
    buddy: [],
    mentor: [],
    manager: [],
  };
}

function normalizeSpecialRoles(
  input?: Partial<Record<SpecialParticipantRole, string[]>>
): SpecialRoleDirectory {
  const normalized = createEmptySpecialRoleDirectory();
  if (!input) return normalized;

  for (const role of SPECIAL_PARTICIPANT_ROLES) {
    normalized[role] = normalizeAngels(input[role] ?? []);
  }
  return normalized;
}

async function hasMemberSchema(): Promise<boolean> {
  const [row] = await query<{
    memberTeams: string | null;
    teamMembers: string | null;
    angels: string | null;
    specialRoles: string | null;
  }>(
    `select
       to_regclass('public.member_teams')::text as "memberTeams",
       to_regclass('public.member_team_members')::text as "teamMembers",
       to_regclass('public.member_angels')::text as angels,
       to_regclass('public.member_special_roles')::text as "specialRoles"`
  );

  return Boolean(
    row?.memberTeams &&
      row?.teamMembers &&
      row?.angels &&
      row?.specialRoles
  );
}

async function ensureMemberSchema(): Promise<void> {
  if (schemaReady || process.env.SKIP_SCHEMA_CHECK === "1") return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await ensureOperatingUnitSchema();
    const schemaExists = await hasMemberSchema();
    if (schemaExists && !runtimeMigrationsEnabled) {
      await ensureMemberOperatingUnitColumns();
      await ensureMemberIdentityColumns();
      schemaReady = true;
      return;
    }

    await query(
      `create table if not exists public.member_teams (
         team_name text primary key,
         angel_name text not null,
         angel_names text[] not null default '{}'::text[],
         team_order integer not null default 0,
         operating_unit_slug text not null default '${DEFAULT_OPERATING_UNIT_SLUG}',
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       )`
    );

    await query(
      `alter table public.member_teams
       add column if not exists angel_names text[] not null default '{}'::text[]`
    );

    await query(
      `update public.member_teams
       set angel_names = case
         when cardinality(coalesce(angel_names, '{}'::text[])) > 0 then angel_names
         when nullif(trim(angel_name), '') is not null then array[angel_name]
         else '{}'::text[]
       end`
    );

    await query(
      `create index if not exists idx_member_teams_order
       on public.member_teams (team_order asc, team_name asc)`
    );

    await query(
      `create table if not exists public.member_team_members (
         team_name text not null references public.member_teams(team_name) on delete cascade,
         member_name text not null,
         member_id text not null,
         member_order integer not null default 0,
         operating_unit_slug text not null default '${DEFAULT_OPERATING_UNIT_SLUG}',
         created_at timestamptz not null default now(),
         primary key (member_id)
       )`
    );

    await ensureMemberIdentityColumns();

    await query(
      `create index if not exists idx_member_team_members_order
       on public.member_team_members (team_name, member_order asc, member_name asc)`
    );

    await query(
      `create table if not exists public.member_angels (
         angel_name text primary key,
         angel_order integer not null default 0,
         operating_unit_slug text not null default '${DEFAULT_OPERATING_UNIT_SLUG}',
         created_at timestamptz not null default now()
       )`
    );

    await query(
      `create index if not exists idx_member_angels_order
       on public.member_angels (angel_order asc, angel_name asc)`
    );

    await query(
      `create table if not exists public.member_special_roles (
         role text not null check (role in ('supporter', 'buddy', 'mentor', 'manager')),
         member_name text not null,
         member_order integer not null default 0,
         operating_unit_slug text not null default '${DEFAULT_OPERATING_UNIT_SLUG}',
         created_at timestamptz not null default now(),
         primary key (role, member_name)
       )`
    );

    await query(
      `create index if not exists idx_member_special_roles_order
       on public.member_special_roles (role, member_order asc, member_name asc)`
    );

    await ensureMemberOperatingUnitColumns();

    schemaReady = true;
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

async function ensureMemberOperatingUnitColumns(): Promise<void> {
  await ensureOperatingUnitColumn("member_teams", "idx_member_teams_operating_unit");
  await ensureOperatingUnitColumn("member_team_members", "idx_member_team_members_operating_unit");
  await ensureOperatingUnitColumn("member_angels", "idx_member_angels_operating_unit");
  await ensureOperatingUnitColumn("member_special_roles", "idx_member_special_roles_operating_unit");
}

async function ensureMemberIdentityColumns(): Promise<void> {
  await query(
    `alter table public.member_team_members
     add column if not exists member_id text`
  );

  await query(
    `update public.member_team_members
     set member_id = 'legacy-' || md5(coalesce(operating_unit_slug, '${DEFAULT_OPERATING_UNIT_SLUG}') || ':' || team_name || ':' || member_name)
     where member_id is null
        or trim(member_id) = ''`
  );

  await query(
    `alter table public.member_team_members
     alter column member_id set not null`
  );

  await query(
    `do $$
     declare
       item record;
     begin
       for item in
         select conname
         from pg_constraint
         where conrelid = 'public.member_team_members'::regclass
           and contype in ('p', 'u')
       loop
         execute format('alter table public.member_team_members drop constraint if exists %I', item.conname);
       end loop;
     end
     $$`
  );

  await query(
    `create unique index if not exists idx_member_team_members_member_id
     on public.member_team_members (member_id)`
  );
}

async function migrateLegacyRosterDataIfNeeded(): Promise<void> {
  if (legacyMigrationChecked) {
    return;
  }

  const memberCountRows = await query<CountRow>(
    `select count(*)::text as count from public.member_teams`
  );
  const memberCount = Number.parseInt(memberCountRows[0]?.count ?? "0", 10);
  if (memberCount > 0) {
    legacyMigrationChecked = true;
    return;
  }

  const legacyTables = await query<LegacyTableRow>(
    `select to_regclass('public.roster_teams')::text as name
     union all
     select to_regclass('public.roster_team_students')::text as name
     union all
     select to_regclass('public.roster_angels')::text as name`
  );

  const allLegacyPresent = legacyTables.every((row) => row.name !== null);
  if (!allLegacyPresent) {
    legacyMigrationChecked = true;
    return;
  }

  await query(
    `insert into public.member_teams (team_name, angel_name, angel_names, team_order)
     select team_name, angel_name, array[angel_name], team_order
     from public.roster_teams
     on conflict (team_name)
     do update set
       angel_name = excluded.angel_name,
       angel_names = excluded.angel_names,
       team_order = excluded.team_order,
       updated_at = now()`
  );

  await query(
    `insert into public.member_team_members (team_name, member_name, member_order)
     select team_name, student_name as member_name, student_order as member_order
     from public.roster_team_students
     on conflict (team_name, member_name)
     do update set member_order = excluded.member_order`
  );

  await query(
    `insert into public.member_angels (angel_name, angel_order)
     select angel_name, angel_order
     from public.roster_angels
     on conflict (angel_name)
     do update set angel_order = excluded.angel_order`
  );

  legacyMigrationChecked = true;
}

export async function loadMemberPreset(): Promise<MemberPreset> {
  await ensureMemberSchema();
  await migrateLegacyRosterDataIfNeeded();

  const teamRows = await query<DbTeamRow>(
    `select
       t.team_name as "teamName",
       case
         when cardinality(coalesce(t.angel_names, '{}'::text[])) > 0 then t.angel_names
         when nullif(trim(t.angel_name), '') is not null then array[t.angel_name]
         else '{}'::text[]
       end as "angelNames",
       m.member_id as "memberId",
       m.member_name as "memberName",
       m.member_order as "memberOrder"
     from public.member_teams t
     left join public.member_team_members m
       on m.team_name = t.team_name
      and coalesce(m.operating_unit_slug, $1) = $1
     where coalesce(t.operating_unit_slug, $1) = $1
     order by t.team_order asc, t.team_name asc, m.member_order asc, m.member_name asc`,
    [DEFAULT_OPERATING_UNIT_SLUG]
  );

  const groups: TeamMemberGroup[] = [];
  const groupMap = new Map<string, TeamMemberGroup>();
  for (const row of teamRows) {
    let group = groupMap.get(row.teamName);
    if (!group) {
      group = {
        teamName: row.teamName,
        angels: normalizeAngels(row.angelNames ?? []).slice(0, 2),
        memberEntries: [],
        members: [],
      };
      groupMap.set(row.teamName, group);
      groups.push(group);
    }
    if (row.memberName) {
      group.memberEntries?.push({
        id: row.memberId ?? randomUUID(),
        name: row.memberName,
        order: row.memberOrder ?? group.members.length,
      });
      group.members.push(row.memberName);
    }
  }

  const angelRows = await query<DbAngelRow>(
    `select angel_name as "angelName"
     from public.member_angels
     where coalesce(operating_unit_slug, $1) = $1
     order by angel_order asc, angel_name asc`,
    [DEFAULT_OPERATING_UNIT_SLUG]
  );

  const specialRoleRows = await query<DbSpecialRoleRow>(
    `select
       role,
       member_name as "memberName"
     from public.member_special_roles
     where coalesce(operating_unit_slug, $1) = $1
     order by
       case role
         when 'mentor' then 1
         when 'manager' then 2
         when 'supporter' then 3
         when 'buddy' then 4
       else 5
       end asc,
       member_order asc,
       member_name asc`,
    [DEFAULT_OPERATING_UNIT_SLUG]
  );
  const specialRoles = createEmptySpecialRoleDirectory();
  for (const row of specialRoleRows) {
    const list = specialRoles[row.role] ?? [];
    list.push(row.memberName);
    specialRoles[row.role] = list;
  }

  return {
    teamGroups: groups,
    fixedAngels: angelRows.map((row) => row.angelName),
    specialRoles,
    source: "db",
  };
}

export async function saveMemberPresetToDb(
  teamGroups: TeamMemberGroup[],
  fixedAngels: string[],
  specialRolesInput?: Partial<Record<SpecialParticipantRole, string[]>>
): Promise<void> {
  await ensureMemberSchema();

  const normalizedGroups = normalizeTeamGroups(teamGroups);
  const normalizedAngels = normalizeAngels(fixedAngels);
  const normalizedSpecialRoles = specialRolesInput
    ? normalizeSpecialRoles(specialRolesInput)
    : null;

  if (normalizedGroups.length === 0 || normalizedAngels.length === 0) {
    throw new Error("팀 그룹 또는 엔젤 목록이 비어 있어 저장할 수 없습니다.");
  }

  const teamNames = normalizedGroups.map((group) => group.teamName);

  await withTransaction(async (tq) => {
    for (const [teamOrder, group] of normalizedGroups.entries()) {
      await tq(
        `insert into public.member_teams (team_name, angel_name, angel_names, team_order, operating_unit_slug)
         values ($1, $2, $3::text[], $4, $5)
         on conflict (team_name)
         do update set
           angel_name = excluded.angel_name,
           angel_names = excluded.angel_names,
           team_order = excluded.team_order,
           operating_unit_slug = excluded.operating_unit_slug,
           updated_at = now()`,
        [group.teamName, group.angels[0] ?? "", group.angels, teamOrder, DEFAULT_OPERATING_UNIT_SLUG]
      );

      await tq(
        `delete from public.member_team_members
         where team_name = $1
           and coalesce(operating_unit_slug, $2) = $2`,
        [group.teamName, DEFAULT_OPERATING_UNIT_SLUG]
      );

      for (const [memberOrder, member] of (group.memberEntries ?? []).entries()) {
        await tq(
          `insert into public.member_team_members (team_name, member_id, member_name, member_order, operating_unit_slug)
           values ($1, $2, $3, $4, $5)`,
          [group.teamName, member.id, member.name, memberOrder, DEFAULT_OPERATING_UNIT_SLUG]
        );
      }
    }

    await tq(
      `delete from public.member_teams
       where coalesce(operating_unit_slug, $2) = $2
         and not (team_name = any($1::text[]))`,
      [teamNames, DEFAULT_OPERATING_UNIT_SLUG]
    );

    await tq(
      `delete from public.member_angels
       where coalesce(operating_unit_slug, $2) = $2
         and not (angel_name = any($1::text[]))`,
      [normalizedAngels, DEFAULT_OPERATING_UNIT_SLUG]
    );

    for (const [angelOrder, angelName] of normalizedAngels.entries()) {
      await tq(
        `insert into public.member_angels (angel_name, angel_order, operating_unit_slug)
         values ($1, $2, $3)
         on conflict (angel_name)
         do update set
           angel_order = excluded.angel_order,
           operating_unit_slug = excluded.operating_unit_slug`,
        [angelName, angelOrder, DEFAULT_OPERATING_UNIT_SLUG]
      );
    }

    if (normalizedSpecialRoles) {
      for (const role of SPECIAL_PARTICIPANT_ROLES) {
        const members = normalizedSpecialRoles[role] ?? [];
        await tq(
          `delete from public.member_special_roles
           where role = $1
             and coalesce(operating_unit_slug, $3) = $3
             and not (member_name = any($2::text[]))`,
          [role, members, DEFAULT_OPERATING_UNIT_SLUG]
        );

        for (const [memberOrder, memberName] of members.entries()) {
          await tq(
            `insert into public.member_special_roles (role, member_name, member_order, operating_unit_slug)
             values ($1, $2, $3, $4)
             on conflict (role, member_name)
             do update set
               member_order = excluded.member_order,
               operating_unit_slug = excluded.operating_unit_slug`,
            [role, memberName, memberOrder, DEFAULT_OPERATING_UNIT_SLUG]
          );
        }
      }
    }
  });
}
