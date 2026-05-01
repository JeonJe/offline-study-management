import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";
import { isMasterOverridePassword } from "@/lib/master-password";
import {
  DEFAULT_OPERATING_UNIT_SLUG,
  ensureOperatingUnitColumn,
  ensureOperatingUnitSchema,
} from "@/lib/operating-unit-store";

export type ParticipantRole =
  | "student"
  | "angel"
  | "supporter"
  | "buddy"
  | "mentor"
  | "manager";

/** 모임 정원 상한. UI(input max), Server Action 검증, init schema CHECK 제약을 한 지점으로 묶는다. */
export const MAX_MEETING_CAPACITY = 10000;

/**
 * formData에서 받은 capacity 문자열의 정규화 결과.
 * - empty: 입력 없음(정원 미설정)
 * - value: 0..MAX_MEETING_CAPACITY 사이의 정수
 * - invalid: 음수/소수/비숫자/범위 초과 — 호출자가 사용자 피드백 책임
 */
export type ParsedCapacity =
  | { kind: "empty" }
  | { kind: "value"; value: number }
  | { kind: "invalid" };

/**
 * formData의 capacity raw 문자열을 정규화한다.
 * silent drop을 막기 위해 invalid를 명시적으로 구분한다.
 */
export function parseCapacityInput(raw: string): ParsedCapacity {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { kind: "empty" };
  }
  const parsed = Number(trimmed);
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_MEETING_CAPACITY
  ) {
    return { kind: "invalid" };
  }
  return { kind: "value", value: parsed };
}

export type MeetingSummary = {
  id: string;
  operatingUnitSlug: string;
  title: string;
  meetingDate: string;
  startTime: string;
  location: string;
  description: string | null;
  leaders: string[];
  hasPassword: boolean;
  capacity: number | null;
  studentCount: number;
  operationCount: number;
  totalCount: number;
};

export type RsvpRecord = {
  id: string;
  meetingId: string;
  name: string;
  role: ParticipantRole;
  status: RsvpStatus;
  note: string | null;
  createdAt: string;
};

export type RsvpStatus = "confirmed" | "waitlist";

type CreateMeetingInput = {
  operatingUnitSlug?: string;
  title: string;
  meetingDate: string;
  startTime: string;
  location: string;
  description?: string;
  leaders?: string[];
  password?: string;
  capacity?: number;
};

type CreateRsvpInput = {
  meetingId: string;
  name: string;
  role: ParticipantRole;
  note?: string;
};

type UpdateMeetingInput = {
  id: string;
  title: string;
  meetingDate: string;
  startTime: string;
  location: string;
  description?: string;
  leaders?: string[];
  accessPassword?: string;
  nextPassword?: string;
  clearPassword?: boolean;
  /**
   * 정원. null = 정원 제거(정원 없는 모임으로 전환), 양의 정수 = 정원 설정.
   * undefined 비허용 — 호출자가 항상 명시적으로 의도를 전달해야 한다.
   */
  capacity: number | null;
};

export class MeetingPasswordError extends Error {
  constructor(public readonly code: "password-required" | "password-invalid") {
    super(
      code === "password-required"
        ? "Meeting password is required."
        : "Meeting password is invalid."
    );
    this.name = "MeetingPasswordError";
  }
}

export function isMeetingPasswordError(error: unknown): error is MeetingPasswordError {
  return error instanceof MeetingPasswordError;
}

function normalizeLeaders(leaders?: string[]): string[] {
  if (!leaders) return [];
  const unique = new Set<string>();
  const normalized: string[] = [];
  for (const raw of leaders) {
    const name = raw.trim();
    if (!name || unique.has(name)) continue;
    unique.add(name);
    normalized.push(name);
  }
  return normalized;
}

function normalizeMeetingPassword(password?: string): string | null {
  const normalized = password?.trim() ?? "";
  return normalized ? normalized : null;
}

function hashMeetingPassword(password: string): string {
  return createHash("sha256")
    .update(`saturday-meetup:meeting:${password}`)
    .digest("hex");
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;
const runtimeMigrationsEnabled =
  process.env.DB_RUNTIME_MIGRATIONS === "1" ||
  process.env.DB_RUNTIME_MIGRATIONS === "true";

async function hasMeetupSchema(): Promise<boolean> {
  const [row] = await query<{ meetings: string | null; rsvps: string | null }>(
    `select
       to_regclass('public.meetings')::text as meetings,
       to_regclass('public.rsvps')::text as rsvps`
  );

  return Boolean(row?.meetings && row?.rsvps);
}

async function hasMeetingColumn(columnName: string): Promise<boolean> {
  const [row] = await query<{ exists: boolean }>(
    `select exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'meetings'
         and column_name = $1
     ) as exists`,
    [columnName]
  );

  return Boolean(row?.exists);
}

async function hasRsvpColumn(columnName: string): Promise<boolean> {
  const [row] = await query<{ exists: boolean }>(
    `select exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'rsvps'
         and column_name = $1
     ) as exists`,
    [columnName]
  );

  return Boolean(row?.exists);
}

async function ensureMeetingLeadersColumn(): Promise<void> {
  const hasColumn = await hasMeetingColumn("leaders");
  if (hasColumn) return;

  await query(
    `alter table public.meetings
     add column if not exists leaders text[] not null default '{}'::text[]`
  );
}

async function ensureMeetingPasswordHashColumn(): Promise<void> {
  const hasColumn = await hasMeetingColumn("password_hash");
  if (hasColumn) return;

  await query(
    `alter table public.meetings
     add column if not exists password_hash text`
  );
}

async function ensureMeetingOperatingUnitColumn(): Promise<void> {
  await ensureOperatingUnitColumn("meetings", "idx_meetings_operating_unit");
}

/**
 * meetings 테이블에 capacity 컬럼이 없으면 추가한다.
 * NULL = 정원 없음, 0 이상의 정수 = 최대 참여 인원.
 */
async function ensureMeetingsCapacityColumn(): Promise<void> {
  const hasColumn = await hasMeetingColumn("capacity");
  if (hasColumn) return;

  await query(
    `alter table public.meetings
     add column if not exists capacity integer
     constraint chk_meetings_capacity check (capacity is null or capacity >= 0)`
  );
}

async function ensureRsvpStatusColumn(): Promise<void> {
  const hasColumn = await hasRsvpColumn("status");
  if (!hasColumn) {
    await query(
      `alter table public.rsvps
       add column if not exists status text not null default 'confirmed'`
    );
  }

  await query(
    `update public.rsvps
     set status = 'confirmed'
     where status is null
        or status not in ('confirmed', 'waitlist')`
  );

  await query(
    `do $$
     declare
       item record;
     begin
       for item in
         select conname
         from pg_constraint
         where conrelid = 'public.rsvps'::regclass
           and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%status%'
       loop
         execute format('alter table public.rsvps drop constraint if exists %I', item.conname);
       end loop;
     end
     $$`
  );

  await query(
    `alter table public.rsvps
     add constraint chk_rsvps_status_allowed
     check (status in ('confirmed', 'waitlist'))`
  );
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady || process.env.SKIP_SCHEMA_CHECK === "1") return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await ensureOperatingUnitSchema();
    const schemaExists = await hasMeetupSchema();
    if (schemaExists) {
      await ensureMeetingLeadersColumn();
      await ensureMeetingPasswordHashColumn();
      await ensureMeetingsCapacityColumn();
      await ensureMeetingOperatingUnitColumn();
      await ensureRsvpStatusColumn();
      if (!runtimeMigrationsEnabled) {
        schemaReady = true;
        return;
      }
    }

    await query(
      `create table if not exists public.meetings (
        id uuid primary key,
        title text not null,
        meeting_date date not null,
        start_time time without time zone not null,
        location text not null,
        description text,
        leaders text[] not null default '{}'::text[],
        password_hash text,
        capacity integer,
        constraint chk_meetings_capacity check (capacity is null or capacity >= 0),
        operating_unit_slug text not null default '${DEFAULT_OPERATING_UNIT_SLUG}',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`
    );

    await query(
      `alter table public.meetings
       add column if not exists leaders text[] not null default '{}'::text[]`
    );

    await query(
      `alter table public.meetings
       add column if not exists password_hash text`
    );

    await ensureMeetingOperatingUnitColumn();

    await query(
      `create index if not exists idx_meetings_meeting_date
       on public.meetings (meeting_date desc, start_time desc)`
    );

    await query(
      `create table if not exists public.rsvps (
        id uuid primary key,
        meeting_id uuid not null references public.meetings(id) on delete cascade,
        name text not null,
        role text not null check (role in ('student', 'angel', 'supporter', 'buddy', 'mentor', 'manager')),
        status text not null default 'confirmed' check (status in ('confirmed', 'waitlist')),
        note text,
        created_at timestamptz not null default now()
      )`
    );

    await query(
      `do $$
       declare
         item record;
       begin
         for item in
           select conname
           from pg_constraint
           where conrelid = 'public.rsvps'::regclass
             and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%role%'
         loop
           execute format('alter table public.rsvps drop constraint if exists %I', item.conname);
         end loop;
       end
       $$`
    );

    await query(
      `alter table public.rsvps
       add constraint chk_rsvps_role_allowed
       check (role in ('student', 'angel', 'supporter', 'buddy', 'mentor', 'manager'))`
    );

    await ensureRsvpStatusColumn();

    await query(
      `create index if not exists idx_rsvps_meeting_created
       on public.rsvps (meeting_id, created_at desc)`
    );

    await query(
      `create index if not exists idx_rsvps_meeting_name
       on public.rsvps (meeting_id, lower(name))`
    );

    schemaReady = true;
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

export async function listMeetings(): Promise<MeetingSummary[]> {
  await ensureSchema();

  return query<MeetingSummary>(
    `select
       m.id,
       coalesce(m.operating_unit_slug, '${DEFAULT_OPERATING_UNIT_SLUG}') as "operatingUnitSlug",
       m.title,
       m.meeting_date::text as "meetingDate",
       to_char(m.start_time, 'HH24:MI') as "startTime",
       m.location,
       m.description,
       coalesce(m.leaders, '{}'::text[]) as leaders,
       (m.password_hash is not null) as "hasPassword",
       m.capacity,
       count(r.id) filter (where r.status = 'confirmed' and r.role = 'student')::int as "studentCount",
       count(r.id) filter (where r.status = 'confirmed' and r.role <> 'student')::int as "operationCount",
       count(r.id) filter (where r.status = 'confirmed')::int as "totalCount"
     from public.meetings m
     left join public.rsvps r on r.meeting_id = m.id
     where coalesce(m.operating_unit_slug, $1) = $1
     group by m.id
     order by m.meeting_date desc, m.start_time desc, m.created_at desc`,
    [DEFAULT_OPERATING_UNIT_SLUG]
  );
}

export async function listMeetingsByDate(meetingDate: string): Promise<MeetingSummary[]> {
  await ensureSchema();

  return query<MeetingSummary>(
    `select
       m.id,
       coalesce(m.operating_unit_slug, '${DEFAULT_OPERATING_UNIT_SLUG}') as "operatingUnitSlug",
       m.title,
       m.meeting_date::text as "meetingDate",
       to_char(m.start_time, 'HH24:MI') as "startTime",
       m.location,
       m.description,
       coalesce(m.leaders, '{}'::text[]) as leaders,
       (m.password_hash is not null) as "hasPassword",
       m.capacity,
       count(r.id) filter (where r.status = 'confirmed' and r.role = 'student')::int as "studentCount",
       count(r.id) filter (where r.status = 'confirmed' and r.role <> 'student')::int as "operationCount",
       count(r.id) filter (where r.status = 'confirmed')::int as "totalCount"
     from public.meetings m
     left join public.rsvps r on r.meeting_id = m.id
     where m.meeting_date = $1
       and coalesce(m.operating_unit_slug, $2) = $2
     group by m.id
     order by m.meeting_date desc, m.start_time desc, m.created_at desc`,
    [meetingDate, DEFAULT_OPERATING_UNIT_SLUG]
  );
}

export async function getMeetingById(meetingId: string): Promise<MeetingSummary | null> {
  await ensureSchema();

  const [row] = await query<MeetingSummary>(
    `select
       m.id,
       coalesce(m.operating_unit_slug, '${DEFAULT_OPERATING_UNIT_SLUG}') as "operatingUnitSlug",
       m.title,
       m.meeting_date::text as "meetingDate",
       to_char(m.start_time, 'HH24:MI') as "startTime",
       m.location,
       m.description,
       coalesce(m.leaders, '{}'::text[]) as leaders,
       (m.password_hash is not null) as "hasPassword",
       m.capacity,
       count(r.id) filter (where r.status = 'confirmed' and r.role = 'student')::int as "studentCount",
       count(r.id) filter (where r.status = 'confirmed' and r.role <> 'student')::int as "operationCount",
       count(r.id) filter (where r.status = 'confirmed')::int as "totalCount"
     from public.meetings m
     left join public.rsvps r on r.meeting_id = m.id
     where m.id = $1
     group by m.id
     order by m.meeting_date desc, m.start_time desc, m.created_at desc
     limit 1`,
    [meetingId]
  );

  return row ?? null;
}

export async function getMeetingTitle(meetingId: string): Promise<string> {
  await ensureSchema();

  const [row] = await query<{ title: string }>(
    `select title
     from public.meetings
     where id = $1
     limit 1`,
    [meetingId]
  );

  return row?.title ?? "";
}

export async function createMeeting(input: CreateMeetingInput): Promise<MeetingSummary> {
  await ensureSchema();
  const leaders = normalizeLeaders(input.leaders);
  const password = normalizeMeetingPassword(input.password);
  const passwordHash = password ? hashMeetingPassword(password) : null;

  const [created] = await query<MeetingSummary>(
    `insert into public.meetings (id, title, meeting_date, start_time, location, description, leaders, password_hash, capacity, operating_unit_slug)
     values ($1, $2, $3, $4, $5, nullif($6, ''), $7::text[], $8, $9, $10)
     returning
       id,
       coalesce(operating_unit_slug, '${DEFAULT_OPERATING_UNIT_SLUG}') as "operatingUnitSlug",
       title,
       meeting_date::text as "meetingDate",
       to_char(start_time, 'HH24:MI') as "startTime",
       location,
       description,
       coalesce(leaders, '{}'::text[]) as leaders,
       (password_hash is not null) as "hasPassword",
       capacity,
       0::int as "studentCount",
       0::int as "operationCount",
       0::int as "totalCount"`,
    [
      randomUUID(),
      input.title.trim(),
      input.meetingDate,
      input.startTime,
      input.location.trim(),
      input.description?.trim() ?? "",
      leaders,
      passwordHash,
      input.capacity ?? null,
      input.operatingUnitSlug?.trim() || DEFAULT_OPERATING_UNIT_SLUG,
    ]
  );

  if (!created) throw new Error("Failed to create meeting.");
  return created;
}

export async function listRsvps(
  meetingId: string,
  keyword: string
): Promise<RsvpRecord[]> {
  await ensureSchema();

  const search = keyword.trim();
  return query<RsvpRecord>(
    `select
       id,
       meeting_id as "meetingId",
       name,
       role,
       status,
       note,
       created_at::text as "createdAt"
     from public.rsvps
     where meeting_id = $1
       and ($2 = '' or lower(name) like ('%' || lower($2) || '%'))
     order by created_at asc`,
    [meetingId, search]
  );
}

export async function listRsvpsForMeetings(
  meetingIds: string[],
  keyword: string
): Promise<Record<string, RsvpRecord[]>> {
  await ensureSchema();

  if (meetingIds.length === 0) {
    return {};
  }

  const search = keyword.trim();
  const rows = await query<RsvpRecord>(
    `select
       id,
       meeting_id as "meetingId",
       name,
       role,
       status,
       note,
       created_at::text as "createdAt"
     from public.rsvps
     where meeting_id = any($1::uuid[])
       and ($2 = '' or lower(name) like ('%' || lower($2) || '%'))
     order by created_at asc`,
    [meetingIds, search]
  );

  const grouped: Record<string, RsvpRecord[]> = {};
  for (const meetingId of meetingIds) {
    grouped[meetingId] = [];
  }

  for (const row of rows) {
    if (!grouped[row.meetingId]) {
      grouped[row.meetingId] = [];
    }
    grouped[row.meetingId].push(row);
  }

  return grouped;
}

export async function createRsvp(input: CreateRsvpInput): Promise<void> {
  await createRsvpsBulk(input.meetingId, input.role, [input.name], input.note);
}

export async function createRsvpsBulk(
  meetingId: string,
  role: ParticipantRole,
  names: string[],
  note?: string
): Promise<number> {
  await ensureSchema();

  const normalized = Array.from(
    new Set(
      names
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .slice(0, 120)
    )
  );

  if (normalized.length === 0) {
    return 0;
  }

  const ids = normalized.map(() => randomUUID());
  const roles = normalized.map(() => role);
  const trimmedNote = note?.trim() ?? "";

  const [row] = await query<{ changedCount: number }>(
    `with meeting_lock as (
       select id, capacity
       from public.meetings
       where id = $4
       for update
     ),
     confirmed_count as (
       select count(r.id)::int as count
       from public.rsvps r
       join meeting_lock ml on ml.id = r.meeting_id
       where r.status = 'confirmed'
     ),
     incoming as (
       select
         i.name,
         i.role,
         i.id,
         i.position
       from unnest($1::text[], $2::text[], $3::uuid[])
         with ordinality as i(name, role, id, position)
     ),
     inserted as (
       insert into public.rsvps (id, meeting_id, name, role, status, note)
       select
         i.id,
         $4,
         i.name,
         i.role,
         case
           when ml.capacity is null then 'confirmed'
           when cc.count + i.position <= ml.capacity then 'confirmed'
           else 'waitlist'
         end,
         nullif($5, '')
       from incoming i
       cross join meeting_lock ml
       cross join confirmed_count cc
       where not exists (
         select 1
         from public.rsvps r
         where r.meeting_id = $4
           and lower(r.name) = lower(i.name)
       )
       returning lower(name) as normalized_name
     ),
     upgraded as (
       update public.rsvps r
       set role = i.role,
           note = nullif($5, '')
       from incoming i
       where r.meeting_id = $4
         and lower(r.name) = lower(i.name)
         and r.role = 'student'
         and i.role <> 'student'
       returning lower(r.name) as normalized_name
     )
     select count(*)::int as "changedCount"
     from (
       select normalized_name from inserted
       union
       select normalized_name from upgraded
     ) changed`,
    [normalized, roles, ids, meetingId, trimmedNote]
  );

  return row?.changedCount ?? 0;
}

async function getMeetingPasswordHash(meetingId: string): Promise<string | null> {
  const [row] = await query<{ passwordHash: string | null }>(
    `select password_hash as "passwordHash"
     from public.meetings
     where id = $1
     limit 1`,
    [meetingId]
  );

  return row?.passwordHash ?? null;
}

function assertMeetingPasswordAccess(
  passwordHash: string | null,
  accessPassword?: string
): void {
  if (!passwordHash) return;
  if (isMasterOverridePassword(accessPassword)) return;

  const normalizedAccessPassword = normalizeMeetingPassword(accessPassword);
  if (!normalizedAccessPassword) {
    throw new MeetingPasswordError("password-required");
  }

  const inputHash = hashMeetingPassword(normalizedAccessPassword);
  if (!safeEquals(inputHash, passwordHash)) {
    throw new MeetingPasswordError("password-invalid");
  }
}

export async function updateMeeting(input: UpdateMeetingInput): Promise<void> {
  await ensureSchema();
  const leaders = normalizeLeaders(input.leaders);
  const currentPasswordHash = await getMeetingPasswordHash(input.id);
  assertMeetingPasswordAccess(currentPasswordHash, input.accessPassword);

  const nextPassword = normalizeMeetingPassword(input.nextPassword);
  const nextPasswordHash = input.clearPassword
    ? null
    : nextPassword
      ? hashMeetingPassword(nextPassword)
      : currentPasswordHash;

  await query(
    `update public.meetings
     set title = $2,
         meeting_date = $3,
         start_time = $4,
         location = $5,
         description = nullif($6, ''),
         leaders = $7::text[],
         password_hash = $8,
         capacity = $9,
         updated_at = now()
     where id = $1`,
    [
      input.id,
      input.title.trim(),
      input.meetingDate,
      input.startTime,
      input.location.trim(),
      input.description?.trim() ?? "",
      leaders,
      nextPasswordHash,
      input.capacity,
    ]
  );
}

export async function deleteMeeting(
  meetingId: string,
  accessPassword?: string
): Promise<void> {
  await ensureSchema();
  const currentPasswordHash = await getMeetingPasswordHash(meetingId);
  assertMeetingPasswordAccess(currentPasswordHash, accessPassword);

  await query(
    `delete from public.meetings
     where id = $1`,
    [meetingId]
  );
}

export async function deleteRsvp(
  rsvpId: string,
  meetingId: string
): Promise<void> {
  await ensureSchema();
  await query(
    `delete from public.rsvps
     where id = $1 and meeting_id = $2`,
    [rsvpId, meetingId]
  );
}

export async function updateRsvp(input: {
  id: string;
  meetingId: string;
  name: string;
  role: ParticipantRole;
  note?: string;
}): Promise<void> {
  await ensureSchema();

  await query(
    `update public.rsvps
     set name = $3,
         role = $4,
         note = nullif($5, '')
     where id = $1
       and meeting_id = $2
       and not exists (
         select 1 from public.rsvps
         where meeting_id = $2
           and role = $4
           and lower(name) = lower($3)
           and id != $1
       )`,
    [
      input.id,
      input.meetingId,
      input.name.trim(),
      input.role,
      input.note?.trim() ?? "",
    ]
  );
}
