#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const TEAM_ROSTERS = [
  {
    teamName: "1팀",
    students: ["김대진", "양권모", "장유나", "오민형", "김요한", "서민주", "공명선"],
    angel: "오현직",
  },
  {
    teamName: "2팀",
    students: ["김준영", "이주옥", "한정현", "김평숙", "윤유탁", "박시온", "임동욱"],
    angel: "변숭문",
  },
  {
    teamName: "3팀",
    students: ["엄인국", "강담희", "김윤선", "김동환", "이도현"],
    angel: "이전제",
  },
  {
    teamName: "4팀",
    students: ["김선민", "최영남", "조혜진", "김남진", "연정흠", "최숙희", "정수진"],
    angel: "박한영",
  },
  {
    teamName: "5팀",
    students: ["최호석", "오세룡", "정인철", "김용권", "김지혜", "임나현", "김진수"],
    angel: "임재인",
  },
  {
    teamName: "6팀",
    students: ["김민주", "신형기", "김지형", "김성훈", "류석호", "이대겸", "이준석"],
    angel: "손주선",
  },
  {
    teamName: "7팀",
    students: ["안유진", "박수환", "최선강", "김현우", "김철중", "소윤범", "서태수", "박정호"],
    angel: "김준형",
  },
];

const FIXED_ANGELS = [
  "김준형",
  "박정아",
  "박한영",
  "변숭문",
  "손주선",
  "오현직",
  "이전제",
  "임재인",
];

function loadEnvFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return;

  const raw = fs.readFileSync(resolved, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function ensureSchema(client) {
  await client.query(
    `create table if not exists public.roster_teams (
       team_name text primary key,
       angel_name text not null,
       team_order integer not null default 0,
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now()
     )`
  );

  await client.query(
    `create index if not exists idx_roster_teams_order
     on public.roster_teams (team_order asc, team_name asc)`
  );

  await client.query(
    `create table if not exists public.roster_team_students (
       team_name text not null references public.roster_teams(team_name) on delete cascade,
       student_name text not null,
       student_order integer not null default 0,
       created_at timestamptz not null default now(),
       primary key (team_name, student_name)
     )`
  );

  await client.query(
    `create index if not exists idx_roster_team_students_order
     on public.roster_team_students (team_name, student_order asc, student_name asc)`
  );

  await client.query(
    `create table if not exists public.roster_angels (
       angel_name text primary key,
       angel_order integer not null default 0,
       created_at timestamptz not null default now()
     )`
  );

  await client.query(
    `create index if not exists idx_roster_angels_order
     on public.roster_angels (angel_order asc, angel_name asc)`
  );
}

try {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await ensureSchema(client);

    for (const [teamOrder, team] of TEAM_ROSTERS.entries()) {
      await client.query(
        `insert into public.roster_teams (team_name, angel_name, team_order)
         values ($1, $2, $3)
         on conflict (team_name)
         do update set
           angel_name = excluded.angel_name,
           team_order = excluded.team_order,
           updated_at = now()`,
        [team.teamName, team.angel, teamOrder]
      );

      await client.query(
        `delete from public.roster_team_students
         where team_name = $1
           and not (student_name = any($2::text[]))`,
        [team.teamName, team.students]
      );

      for (const [studentOrder, studentName] of team.students.entries()) {
        await client.query(
          `insert into public.roster_team_students (team_name, student_name, student_order)
           values ($1, $2, $3)
           on conflict (team_name, student_name)
           do update set student_order = excluded.student_order`,
          [team.teamName, studentName, studentOrder]
        );
      }
    }

    const teamNames = TEAM_ROSTERS.map((row) => row.teamName);
    await client.query(
      `delete from public.roster_teams
       where not (team_name = any($1::text[]))`,
      [teamNames]
    );

    await client.query(
      `delete from public.roster_angels
       where not (angel_name = any($1::text[]))`,
      [FIXED_ANGELS]
    );

    for (const [angelOrder, angelName] of FIXED_ANGELS.entries()) {
      await client.query(
        `insert into public.roster_angels (angel_name, angel_order)
         values ($1, $2)
         on conflict (angel_name)
         do update set angel_order = excluded.angel_order`,
        [angelName, angelOrder]
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const [teamCountResult, studentCountResult, angelCountResult] = await Promise.all([
    pool.query(`select count(*)::int as count from public.roster_teams`),
    pool.query(`select count(*)::int as count from public.roster_team_students`),
    pool.query(`select count(*)::int as count from public.roster_angels`),
  ]);

  const teamCount = teamCountResult.rows[0]?.count ?? 0;
  const studentCount = studentCountResult.rows[0]?.count ?? 0;
  const angelCount = angelCountResult.rows[0]?.count ?? 0;
  console.log("ROSTER_SEEDED", `teams=${teamCount}`, `students=${studentCount}`, `angels=${angelCount}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("ROSTER_SEED_ERROR", message);
  process.exit(1);
} finally {
  await pool.end();
}
