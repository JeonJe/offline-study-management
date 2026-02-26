import { query, withTransaction } from "@/lib/db";

export type TeamMemberGroup = {
  teamName: string;
  members: string[];
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
  memberName: string | null;
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

function normalizeTeamGroups(groups: TeamMemberGroup[]): TeamMemberGroup[] {
  const seenTeams = new Set<string>();
  const normalized: TeamMemberGroup[] = [];

  for (const group of groups) {
    const teamName = group.teamName.trim();
    const angels = normalizeAngels(group.angels ?? []).slice(0, 2);
    if (!teamName || angels.length === 0 || seenTeams.has(teamName)) continue;

    seenTeams.add(teamName);

    const seenMembers = new Set<string>();
    const members: string[] = [];
    for (const memberName of group.members) {
      const member = memberName.trim();
      if (!member || seenMembers.has(member)) continue;
      seenMembers.add(member);
      members.push(member);
    }

    normalized.push({ teamName, angels, members });
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

async function ensureMemberSchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await query(
      `create table if not exists public.member_teams (
         team_name text primary key,
         angel_name text not null,
         angel_names text[] not null default '{}'::text[],
         team_order integer not null default 0,
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
         member_order integer not null default 0,
         created_at timestamptz not null default now(),
         primary key (team_name, member_name)
       )`
    );

    await query(
      `create index if not exists idx_member_team_members_order
       on public.member_team_members (team_name, member_order asc, member_name asc)`
    );

    await query(
      `create table if not exists public.member_angels (
         angel_name text primary key,
         angel_order integer not null default 0,
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
         created_at timestamptz not null default now(),
         primary key (role, member_name)
       )`
    );

    await query(
      `create index if not exists idx_member_special_roles_order
       on public.member_special_roles (role, member_order asc, member_name asc)`
    );

    schemaReady = true;
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

async function migrateLegacyRosterDataIfNeeded(): Promise<void> {
  const memberCountRows = await query<CountRow>(
    `select count(*)::text as count from public.member_teams`
  );
  const memberCount = Number.parseInt(memberCountRows[0]?.count ?? "0", 10);
  if (memberCount > 0) {
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
       m.member_name as "memberName"
     from public.member_teams t
     left join public.member_team_members m on m.team_name = t.team_name
     order by t.team_order asc, t.team_name asc, m.member_order asc, m.member_name asc`
  );

  const groups: TeamMemberGroup[] = [];
  const groupMap = new Map<string, TeamMemberGroup>();
  for (const row of teamRows) {
    let group = groupMap.get(row.teamName);
    if (!group) {
      group = {
        teamName: row.teamName,
        angels: normalizeAngels(row.angelNames ?? []).slice(0, 2),
        members: [],
      };
      groupMap.set(row.teamName, group);
      groups.push(group);
    }
    if (row.memberName) {
      group.members.push(row.memberName);
    }
  }

  const angelRows = await query<DbAngelRow>(
    `select angel_name as "angelName"
     from public.member_angels
     order by angel_order asc, angel_name asc`
  );

  const specialRoleRows = await query<DbSpecialRoleRow>(
    `select
       role,
       member_name as "memberName"
     from public.member_special_roles
     order by
       case role
         when 'mentor' then 1
         when 'manager' then 2
         when 'supporter' then 3
         when 'buddy' then 4
         else 5
       end asc,
       member_order asc,
       member_name asc`
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
        `insert into public.member_teams (team_name, angel_name, angel_names, team_order)
         values ($1, $2, $3::text[], $4)
         on conflict (team_name)
         do update set
           angel_name = excluded.angel_name,
           angel_names = excluded.angel_names,
           team_order = excluded.team_order,
           updated_at = now()`,
        [group.teamName, group.angels[0] ?? "", group.angels, teamOrder]
      );

      await tq(
        `delete from public.member_team_members
         where team_name = $1
           and not (member_name = any($2::text[]))`,
        [group.teamName, group.members]
      );

      for (const [memberOrder, memberName] of group.members.entries()) {
        await tq(
          `insert into public.member_team_members (team_name, member_name, member_order)
           values ($1, $2, $3)
           on conflict (team_name, member_name)
           do update set member_order = excluded.member_order`,
          [group.teamName, memberName, memberOrder]
        );
      }
    }

    await tq(
      `delete from public.member_teams
       where not (team_name = any($1::text[]))`,
      [teamNames]
    );

    await tq(
      `delete from public.member_angels
       where not (angel_name = any($1::text[]))`,
      [normalizedAngels]
    );

    for (const [angelOrder, angelName] of normalizedAngels.entries()) {
      await tq(
        `insert into public.member_angels (angel_name, angel_order)
         values ($1, $2)
         on conflict (angel_name)
         do update set angel_order = excluded.angel_order`,
        [angelName, angelOrder]
      );
    }

    if (normalizedSpecialRoles) {
      for (const role of SPECIAL_PARTICIPANT_ROLES) {
        const members = normalizedSpecialRoles[role] ?? [];
        await tq(
          `delete from public.member_special_roles
           where role = $1
             and not (member_name = any($2::text[]))`,
          [role, members]
        );

        for (const [memberOrder, memberName] of members.entries()) {
          await tq(
            `insert into public.member_special_roles (role, member_name, member_order)
             values ($1, $2, $3)
             on conflict (role, member_name)
             do update set member_order = excluded.member_order`,
            [role, memberName, memberOrder]
          );
        }
      }
    }
  });
}
