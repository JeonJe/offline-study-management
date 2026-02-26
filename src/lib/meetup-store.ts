import { randomUUID } from "node:crypto";
import { query, withTransaction } from "@/lib/db";

export type ParticipantRole =
  | "student"
  | "angel"
  | "supporter"
  | "buddy"
  | "mentor"
  | "manager";

export type MeetingSummary = {
  id: string;
  title: string;
  meetingDate: string;
  startTime: string;
  location: string;
  description: string | null;
  studentCount: number;
  operationCount: number;
  totalCount: number;
};

export type RsvpRecord = {
  id: string;
  meetingId: string;
  name: string;
  role: ParticipantRole;
  note: string | null;
  createdAt: string;
};

type CreateMeetingInput = {
  title: string;
  meetingDate: string;
  startTime: string;
  location: string;
  description?: string;
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
};

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await query(
      `create table if not exists public.meetings (
        id uuid primary key,
        title text not null,
        meeting_date date not null,
        start_time time without time zone not null,
        location text not null,
        description text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`
    );

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
       m.title,
       m.meeting_date::text as "meetingDate",
       to_char(m.start_time, 'HH24:MI') as "startTime",
       m.location,
       m.description,
       count(r.id) filter (where r.role = 'student')::int as "studentCount",
       count(r.id) filter (where r.role <> 'student')::int as "operationCount",
       count(r.id)::int as "totalCount"
     from public.meetings m
     left join public.rsvps r on r.meeting_id = m.id
     group by m.id
     order by m.meeting_date desc, m.start_time desc, m.created_at desc`
  );
}

export async function createMeeting(input: CreateMeetingInput): Promise<MeetingSummary> {
  await ensureSchema();

  const [created] = await query<MeetingSummary>(
    `insert into public.meetings (id, title, meeting_date, start_time, location, description)
     values ($1, $2, $3, $4, $5, nullif($6, ''))
     returning
       id,
       title,
       meeting_date::text as "meetingDate",
       to_char(start_time, 'HH24:MI') as "startTime",
       location,
       description,
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
  await ensureSchema();

  await query(
    `insert into public.rsvps (id, meeting_id, name, role, note)
     select $1, $2, $3, $4, nullif($5, '')
     where not exists (
       select 1
       from public.rsvps
       where meeting_id = $2
         and role = $4
         and lower(name) = lower($3)
     )`,
    [
      randomUUID(),
      input.meetingId,
      input.name.trim(),
      input.role,
      input.note?.trim() ?? "",
    ]
  );
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

  const trimmedNote = note?.trim() ?? "";
  let insertedCount = 0;

  await withTransaction(async (tq) => {
    for (const name of normalized) {
      const rows = await tq<{ id: string }>(
        `insert into public.rsvps (id, meeting_id, name, role, note)
         select $1, $2, $3, $4, nullif($5, '')
         where not exists (
           select 1
           from public.rsvps
           where meeting_id = $2
             and role = $4
             and lower(name) = lower($3)
         )
         returning id`,
        [randomUUID(), meetingId, name, role, trimmedNote]
      );
      insertedCount += rows.length;
    }
  });

  return insertedCount;
}

export async function updateMeeting(input: UpdateMeetingInput): Promise<void> {
  await ensureSchema();

  await query(
    `update public.meetings
     set title = $2,
         meeting_date = $3,
         start_time = $4,
         location = $5,
         description = nullif($6, ''),
         updated_at = now()
     where id = $1`,
    [
      input.id,
      input.title.trim(),
      input.meetingDate,
      input.startTime,
      input.location.trim(),
      input.description?.trim() ?? "",
    ]
  );
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  await ensureSchema();

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
