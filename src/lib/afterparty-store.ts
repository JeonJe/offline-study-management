import { randomUUID } from "node:crypto";
import { query, withTransaction } from "@/lib/db";

export type AfterpartySummary = {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  location: string;
  description: string | null;
  settlementManager: string | null;
  settlementAccount: string | null;
  participantCount: number;
};

export type AfterpartyParticipant = {
  id: string;
  afterpartyId: string;
  name: string;
  isSettled: boolean;
  createdAt: string;
};

type CreateAfterpartyInput = {
  title: string;
  eventDate: string;
  startTime: string;
  location: string;
  description?: string;
  settlementManager?: string;
  settlementAccount?: string;
};

type UpdateAfterpartyInput = {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  location: string;
  description?: string;
  settlementManager?: string;
  settlementAccount?: string;
};

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureAfterpartySchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await query(
      `create table if not exists public.afterparties (
        id uuid primary key,
        title text not null,
        event_date date not null,
        start_time time without time zone not null,
        location text not null,
        description text,
        settlement_manager text,
        settlement_account text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`
    );

    await query(
      `alter table public.afterparties
       add column if not exists settlement_manager text`
    );

    await query(
      `alter table public.afterparties
       add column if not exists settlement_account text`
    );

    await query(
      `create index if not exists idx_afterparties_event_date
       on public.afterparties (event_date desc, start_time desc)`
    );

    await query(
      `do $$
       declare
         item record;
       begin
         for item in
           select conname
           from pg_constraint
           where conrelid = 'public.afterparties'::regclass
             and contype = 'u'
         loop
           execute format('alter table public.afterparties drop constraint if exists %I', item.conname);
         end loop;

         for item in
           select i.relname as index_name
           from pg_class t
           join pg_index x on t.oid = x.indrelid
           join pg_class i on i.oid = x.indexrelid
           join pg_namespace n on n.oid = t.relnamespace
           where n.nspname = 'public'
             and t.relname = 'afterparties'
             and x.indisunique = true
             and x.indisprimary = false
         loop
           execute format('drop index if exists public.%I', item.index_name);
         end loop;
       end
       $$`
    );

    await query(
      `create table if not exists public.afterparty_participants (
        id uuid primary key,
        afterparty_id uuid not null references public.afterparties(id) on delete cascade,
        name text not null,
        is_settled boolean not null default false,
        created_at timestamptz not null default now()
      )`
    );

    await query(
      `alter table public.afterparty_participants
       add column if not exists is_settled boolean not null default false`
    );

    await query(
      `create index if not exists idx_afterparty_participants_created
       on public.afterparty_participants (afterparty_id, created_at desc)`
    );

    await query(
      `create index if not exists idx_afterparty_participants_name
       on public.afterparty_participants (afterparty_id, lower(name))`
    );

    await query(
      `create unique index if not exists idx_afterparty_participants_unique_name
       on public.afterparty_participants (afterparty_id, lower(name))`
    );

    schemaReady = true;
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

export async function listAfterparties(): Promise<AfterpartySummary[]> {
  await ensureAfterpartySchema();

  return query<AfterpartySummary>(
    `select
       a.id,
       a.title,
       a.event_date::text as "eventDate",
       to_char(a.start_time, 'HH24:MI') as "startTime",
       a.location,
       a.description,
       a.settlement_manager as "settlementManager",
       a.settlement_account as "settlementAccount",
       count(p.id)::int as "participantCount"
     from public.afterparties a
     left join public.afterparty_participants p on p.afterparty_id = a.id
     group by a.id
     order by a.event_date desc, a.start_time desc, a.created_at desc`
  );
}

export async function listParticipantsForAfterparties(
  afterpartyIds: string[],
  keyword: string
): Promise<Record<string, AfterpartyParticipant[]>> {
  await ensureAfterpartySchema();

  if (afterpartyIds.length === 0) {
    return {};
  }

  const search = keyword.trim();
  const rows = await query<AfterpartyParticipant>(
    `select
       id,
       afterparty_id as "afterpartyId",
       name,
       is_settled as "isSettled",
       created_at::text as "createdAt"
     from public.afterparty_participants
     where afterparty_id = any($1::uuid[])
       and ($2 = '' or lower(name) like ('%' || lower($2) || '%'))
     order by created_at asc`,
    [afterpartyIds, search]
  );

  const grouped: Record<string, AfterpartyParticipant[]> = {};
  for (const afterpartyId of afterpartyIds) {
    grouped[afterpartyId] = [];
  }

  for (const row of rows) {
    if (!grouped[row.afterpartyId]) {
      grouped[row.afterpartyId] = [];
    }
    grouped[row.afterpartyId].push(row);
  }

  return grouped;
}

export async function createAfterparty(input: CreateAfterpartyInput): Promise<AfterpartySummary> {
  await ensureAfterpartySchema();

  const [created] = await query<AfterpartySummary>(
    `insert into public.afterparties (
       id,
       title,
       event_date,
       start_time,
       location,
       description,
       settlement_manager,
       settlement_account
     )
     values ($1, $2, $3, $4, $5, nullif($6, ''), nullif($7, ''), nullif($8, ''))
     returning
       id,
       title,
       event_date::text as "eventDate",
       to_char(start_time, 'HH24:MI') as "startTime",
       location,
       description,
       settlement_manager as "settlementManager",
       settlement_account as "settlementAccount",
       0::int as "participantCount"`,
    [
      randomUUID(),
      input.title.trim(),
      input.eventDate,
      input.startTime,
      input.location.trim(),
      input.description?.trim() ?? "",
      input.settlementManager?.trim() ?? "",
      input.settlementAccount?.trim() ?? "",
    ]
  );

  if (!created) {
    throw new Error("Failed to create afterparty.");
  }

  return created;
}

export async function updateAfterparty(input: UpdateAfterpartyInput): Promise<void> {
  await ensureAfterpartySchema();

  await query(
    `update public.afterparties
     set title = $2,
         event_date = $3,
         start_time = $4,
         location = $5,
         description = nullif($6, ''),
         settlement_manager = nullif($7, ''),
         settlement_account = nullif($8, ''),
         updated_at = now()
     where id = $1`,
    [
      input.id,
      input.title.trim(),
      input.eventDate,
      input.startTime,
      input.location.trim(),
      input.description?.trim() ?? "",
      input.settlementManager?.trim() ?? "",
      input.settlementAccount?.trim() ?? "",
    ]
  );
}

export async function createAfterpartyParticipantsBulk(
  afterpartyId: string,
  names: string[]
): Promise<number> {
  await ensureAfterpartySchema();

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

  let insertedCount = 0;

  await withTransaction(async (tq) => {
    for (const name of normalized) {
      const rows = await tq<{ id: string }>(
        `insert into public.afterparty_participants (id, afterparty_id, name)
         select $1, $2, $3
         where not exists (
           select 1
           from public.afterparty_participants
           where afterparty_id = $2
             and lower(name) = lower($3)
         )
         returning id`,
        [randomUUID(), afterpartyId, name]
      );
      insertedCount += rows.length;
    }
  });

  return insertedCount;
}

export async function deleteAfterpartyParticipant(
  participantId: string,
  afterpartyId: string
): Promise<void> {
  await ensureAfterpartySchema();

  await query(
    `delete from public.afterparty_participants
     where id = $1 and afterparty_id = $2`,
    [participantId, afterpartyId]
  );
}

export async function updateAfterpartyParticipantSettlement(
  participantId: string,
  afterpartyId: string,
  isSettled: boolean
): Promise<void> {
  await ensureAfterpartySchema();

  await query(
    `update public.afterparty_participants
     set is_settled = $3
     where id = $1 and afterparty_id = $2`,
    [participantId, afterpartyId, isSettled]
  );
}

export async function deleteAfterparty(afterpartyId: string): Promise<void> {
  await ensureAfterpartySchema();

  await query(
    `delete from public.afterparties
     where id = $1`,
    [afterpartyId]
  );
}
