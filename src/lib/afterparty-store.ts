import { randomUUID } from "node:crypto";
import { query, withTransaction } from "@/lib/db";
import type { ParticipantRole } from "@/lib/meetup-store";

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
  settlementCount: number;
};

export type AfterpartyParticipant = {
  id: string;
  afterpartyId: string;
  name: string;
  role: ParticipantRole;
  isSettled: boolean;
  createdAt: string;
};

export type AfterpartySettlement = {
  id: string;
  afterpartyId: string;
  title: string;
  settlementManager: string | null;
  settlementAccount: string | null;
  sortOrder: number;
  participantCount: number;
  settledCount: number;
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
};

type CreateAfterpartySettlementInput = {
  afterpartyId: string;
  title: string;
  settlementManager?: string;
  settlementAccount?: string;
};

type UpdateAfterpartySettlementInput = {
  id: string;
  afterpartyId: string;
  title: string;
  settlementManager?: string;
  settlementAccount?: string;
};

type TxQuery = <R>(text: string, params?: unknown[]) => Promise<R[]>;
type CreateAfterpartyParticipantInput = {
  name: string;
  role: ParticipantRole;
};

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureAfterpartySchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await query(`create extension if not exists pgcrypto`);

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
        role text not null check (role in ('student', 'angel', 'supporter', 'buddy', 'mentor', 'manager')),
        is_settled boolean not null default false,
        created_at timestamptz not null default now()
      )`
    );

    await query(
      `alter table public.afterparty_participants
       add column if not exists role text`
    );

    await query(
      `update public.afterparty_participants
       set role = 'student'
       where role is null
          or btrim(role) = ''`
    );

    await query(
      `alter table public.afterparty_participants
       alter column role set default 'student'`
    );

    await query(
      `alter table public.afterparty_participants
       alter column role set not null`
    );

    await query(
      `do $$
       declare
         item record;
       begin
         for item in
           select conname
           from pg_constraint
           where conrelid = 'public.afterparty_participants'::regclass
             and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%role%'
         loop
           execute format('alter table public.afterparty_participants drop constraint if exists %I', item.conname);
         end loop;
       end
       $$`
    );

    await query(
      `alter table public.afterparty_participants
       add constraint chk_afterparty_participants_role_allowed
       check (role in ('student', 'angel', 'supporter', 'buddy', 'mentor', 'manager'))`
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

    await query(
      `create table if not exists public.afterparty_settlements (
        id uuid primary key,
        afterparty_id uuid not null references public.afterparties(id) on delete cascade,
        title text not null,
        settlement_manager text,
        settlement_account text,
        sort_order integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`
    );

    await query(
      `alter table public.afterparty_settlements
       add column if not exists settlement_manager text`
    );

    await query(
      `alter table public.afterparty_settlements
       add column if not exists settlement_account text`
    );

    await query(
      `alter table public.afterparty_settlements
       add column if not exists sort_order integer not null default 0`
    );

    await query(
      `create index if not exists idx_afterparty_settlements_order
       on public.afterparty_settlements (afterparty_id, sort_order asc, created_at asc)`
    );

    await query(
      `create table if not exists public.afterparty_settlement_participants (
        settlement_id uuid not null references public.afterparty_settlements(id) on delete cascade,
        participant_id uuid not null references public.afterparty_participants(id) on delete cascade,
        is_settled boolean not null default false,
        settled_at timestamptz,
        created_at timestamptz not null default now(),
        primary key (settlement_id, participant_id)
      )`
    );

    await query(
      `alter table public.afterparty_settlement_participants
       add column if not exists is_settled boolean not null default false`
    );

    await query(
      `alter table public.afterparty_settlement_participants
       add column if not exists settled_at timestamptz`
    );

    await query(
      `create index if not exists idx_afterparty_settlement_participants_settlement
       on public.afterparty_settlement_participants (settlement_id, created_at asc)`
    );

    await query(
      `create index if not exists idx_afterparty_settlement_participants_participant
       on public.afterparty_settlement_participants (participant_id)`
    );

    await query(
      `insert into public.afterparty_settlements (
         id,
         afterparty_id,
         title,
         settlement_manager,
         settlement_account,
         sort_order
       )
       select
         gen_random_uuid(),
         a.id,
         '기본 정산',
         nullif(a.settlement_manager, ''),
         nullif(a.settlement_account, ''),
         0
       from public.afterparties a
       where not exists (
         select 1
         from public.afterparty_settlements s
         where s.afterparty_id = a.id
       )`
    );

    await query(
      `with primary_settlements as (
         select distinct on (s.afterparty_id)
           s.afterparty_id,
           s.id
         from public.afterparty_settlements s
         order by s.afterparty_id, s.sort_order asc, s.created_at asc, s.id asc
       )
       insert into public.afterparty_settlement_participants (
         settlement_id,
         participant_id,
         is_settled,
         settled_at
       )
       select
         ps.id,
         p.id,
         p.is_settled,
         case when p.is_settled then now() else null end
       from public.afterparty_participants p
       join primary_settlements ps on ps.afterparty_id = p.afterparty_id
       where not exists (
         select 1
         from public.afterparty_settlement_participants sp
         where sp.settlement_id = ps.id
           and sp.participant_id = p.id
       )`
    );

    await query(
      `delete from public.afterparty_participants p
       where not exists (
         select 1
         from public.afterparty_settlement_participants sp
         where sp.participant_id = p.id
       )`
    );

    await query(
      `update public.afterparties a
       set
         settlement_manager = p.settlement_manager,
         settlement_account = p.settlement_account
       from (
         select distinct on (s.afterparty_id)
           s.afterparty_id,
           s.settlement_manager,
           s.settlement_account
         from public.afterparty_settlements s
         order by s.afterparty_id, s.sort_order asc, s.created_at asc, s.id asc
       ) p
       where a.id = p.afterparty_id`
    );

    schemaReady = true;
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

async function resolvePrimarySettlementId(tq: TxQuery, afterpartyId: string): Promise<string | null> {
  const [row] = await tq<{ id: string }>(
    `select id
     from public.afterparty_settlements
     where afterparty_id = $1
     order by sort_order asc, created_at asc, id asc
     limit 1`,
    [afterpartyId]
  );

  return row?.id ?? null;
}

async function ensureTargetSettlementId(
  tq: TxQuery,
  afterpartyId: string,
  requestedSettlementId?: string
): Promise<string> {
  if (requestedSettlementId) {
    const [existing] = await tq<{ id: string }>(
      `select id
       from public.afterparty_settlements
       where id = $1
         and afterparty_id = $2`,
      [requestedSettlementId, afterpartyId]
    );

    if (existing) {
      return existing.id;
    }
  }

  const primaryId = await resolvePrimarySettlementId(tq, afterpartyId);
  if (primaryId) {
    return primaryId;
  }

  const [afterparty] = await tq<{ settlementManager: string | null; settlementAccount: string | null }>(
    `select
       settlement_manager as "settlementManager",
       settlement_account as "settlementAccount"
     from public.afterparties
     where id = $1`,
    [afterpartyId]
  );

  const fallbackId = randomUUID();
  await tq(
    `insert into public.afterparty_settlements (
       id,
       afterparty_id,
       title,
       settlement_manager,
       settlement_account,
       sort_order
     )
     values ($1, $2, '기본 정산', nullif($3, ''), nullif($4, ''), 0)`,
    [
      fallbackId,
      afterpartyId,
      afterparty?.settlementManager?.trim() ?? "",
      afterparty?.settlementAccount?.trim() ?? "",
    ]
  );

  return fallbackId;
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
       coalesce(primary_settlement.settlement_manager, a.settlement_manager) as "settlementManager",
       coalesce(primary_settlement.settlement_account, a.settlement_account) as "settlementAccount",
       coalesce(participant_stats.participant_count, 0)::int as "participantCount",
       coalesce(settlement_stats.settlement_count, 0)::int as "settlementCount"
     from public.afterparties a
     left join lateral (
       select
         s.settlement_manager,
         s.settlement_account
       from public.afterparty_settlements s
       where s.afterparty_id = a.id
       order by s.sort_order asc, s.created_at asc, s.id asc
       limit 1
     ) primary_settlement on true
     left join lateral (
       select count(*)::int as participant_count
       from public.afterparty_participants p
       where p.afterparty_id = a.id
     ) participant_stats on true
     left join lateral (
       select count(*)::int as settlement_count
       from public.afterparty_settlements s
       where s.afterparty_id = a.id
     ) settlement_stats on true
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
       p.id,
       p.afterparty_id as "afterpartyId",
       p.name,
       coalesce(nullif(p.role, ''), 'student') as role,
       coalesce(bool_and(sp.is_settled), false) as "isSettled",
       p.created_at::text as "createdAt"
     from public.afterparty_participants p
     left join public.afterparty_settlement_participants sp
       on sp.participant_id = p.id
     where p.afterparty_id = any($1::uuid[])
       and ($2 = '' or lower(p.name) like ('%' || lower($2) || '%'))
     group by p.id
     order by p.created_at asc`,
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

export async function listSettlementsForAfterparty(
  afterpartyId: string
): Promise<AfterpartySettlement[]> {
  const grouped = await listSettlementsForAfterparties([afterpartyId]);
  return grouped[afterpartyId] ?? [];
}

export async function listSettlementsForAfterparties(
  afterpartyIds: string[]
): Promise<Record<string, AfterpartySettlement[]>> {
  await ensureAfterpartySchema();

  if (afterpartyIds.length === 0) {
    return {};
  }

  const rows = await query<AfterpartySettlement>(
    `select
       s.id,
       s.afterparty_id as "afterpartyId",
       s.title,
       s.settlement_manager as "settlementManager",
       s.settlement_account as "settlementAccount",
       s.sort_order as "sortOrder",
       count(sp.participant_id)::int as "participantCount",
       count(sp.participant_id) filter (where sp.is_settled)::int as "settledCount",
       s.created_at::text as "createdAt"
     from public.afterparty_settlements s
     left join public.afterparty_settlement_participants sp
       on sp.settlement_id = s.id
     where s.afterparty_id = any($1::uuid[])
     group by s.id
     order by s.afterparty_id asc, s.sort_order asc, s.created_at asc, s.id asc`,
    [afterpartyIds]
  );

  const grouped: Record<string, AfterpartySettlement[]> = {};
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

export async function listParticipantsForSettlement(
  settlementId: string,
  keyword: string
): Promise<AfterpartyParticipant[]> {
  await ensureAfterpartySchema();

  const search = keyword.trim();
  return query<AfterpartyParticipant>(
    `select
       p.id,
       p.afterparty_id as "afterpartyId",
       p.name,
       coalesce(nullif(p.role, ''), 'student') as role,
       coalesce(sp.is_settled, false) as "isSettled",
       p.created_at::text as "createdAt"
     from public.afterparty_settlement_participants sp
     join public.afterparty_participants p
       on p.id = sp.participant_id
     where sp.settlement_id = $1
       and ($2 = '' or lower(p.name) like ('%' || lower($2) || '%'))
     order by p.created_at asc`,
    [settlementId, search]
  );
}

export async function createAfterparty(input: CreateAfterpartyInput): Promise<AfterpartySummary> {
  await ensureAfterpartySchema();

  return withTransaction(async (tq) => {
    const afterpartyId = randomUUID();
    const settlementManager = input.settlementManager?.trim() ?? "";
    const settlementAccount = input.settlementAccount?.trim() ?? "";

    const [created] = await tq<AfterpartySummary>(
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
         0::int as "participantCount",
         1::int as "settlementCount"`,
      [
        afterpartyId,
        input.title.trim(),
        input.eventDate,
        input.startTime,
        input.location.trim(),
        input.description?.trim() ?? "",
        settlementManager,
        settlementAccount,
      ]
    );

    if (!created) {
      throw new Error("Failed to create afterparty.");
    }

    await tq(
      `insert into public.afterparty_settlements (
         id,
         afterparty_id,
         title,
         settlement_manager,
         settlement_account,
         sort_order
       )
       values ($1, $2, '기본 정산', nullif($3, ''), nullif($4, ''), 0)`,
      [randomUUID(), created.id, settlementManager, settlementAccount]
    );

    return created;
  });
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
         updated_at = now()
     where id = $1`,
    [
      input.id,
      input.title.trim(),
      input.eventDate,
      input.startTime,
      input.location.trim(),
      input.description?.trim() ?? "",
    ]
  );
}

export async function createAfterpartySettlement(
  input: CreateAfterpartySettlementInput
): Promise<AfterpartySettlement> {
  await ensureAfterpartySchema();

  return withTransaction(async (tq) => {
    const [orderRow] = await tq<{ nextOrder: number }>(
      `select coalesce(max(sort_order), -1) + 1 as "nextOrder"
       from public.afterparty_settlements
       where afterparty_id = $1`,
      [input.afterpartyId]
    );

    const nextOrder = orderRow?.nextOrder ?? 0;
    const manager = input.settlementManager?.trim() ?? "";
    const account = input.settlementAccount?.trim() ?? "";

    const [created] = await tq<AfterpartySettlement>(
      `insert into public.afterparty_settlements (
         id,
         afterparty_id,
         title,
         settlement_manager,
         settlement_account,
         sort_order
       )
       values ($1, $2, $3, nullif($4, ''), nullif($5, ''), $6)
       returning
         id,
         afterparty_id as "afterpartyId",
         title,
         settlement_manager as "settlementManager",
         settlement_account as "settlementAccount",
         sort_order as "sortOrder",
         0::int as "participantCount",
         0::int as "settledCount",
         created_at::text as "createdAt"`,
      [
        randomUUID(),
        input.afterpartyId,
        input.title.trim(),
        manager,
        account,
        nextOrder,
      ]
    );

    if (!created) {
      throw new Error("Failed to create settlement.");
    }

    if (nextOrder === 0) {
      await tq(
        `update public.afterparties
         set settlement_manager = nullif($2, ''),
             settlement_account = nullif($3, '')
         where id = $1`,
        [input.afterpartyId, manager, account]
      );
    }

    return created;
  });
}

export async function updateAfterpartySettlement(
  input: UpdateAfterpartySettlementInput
): Promise<void> {
  await ensureAfterpartySchema();

  await withTransaction(async (tq) => {
    const manager = input.settlementManager?.trim() ?? "";
    const account = input.settlementAccount?.trim() ?? "";

    await tq(
      `update public.afterparty_settlements
       set title = $3,
           settlement_manager = nullif($4, ''),
           settlement_account = nullif($5, ''),
           updated_at = now()
       where id = $1
         and afterparty_id = $2`,
      [input.id, input.afterpartyId, input.title.trim(), manager, account]
    );

    const [primary] = await tq<{ id: string }>(
      `select id
       from public.afterparty_settlements
       where afterparty_id = $1
       order by sort_order asc, created_at asc, id asc
       limit 1`,
      [input.afterpartyId]
    );

    if (primary?.id === input.id) {
      await tq(
        `update public.afterparties
         set settlement_manager = nullif($2, ''),
             settlement_account = nullif($3, '')
         where id = $1`,
        [input.afterpartyId, manager, account]
      );
    }
  });
}

export async function deleteAfterpartySettlement(
  settlementId: string,
  afterpartyId: string
): Promise<string> {
  await ensureAfterpartySchema();

  return withTransaction(async (tq) => {
    const [countRow] = await tq<{ count: number }>(
      `select count(*)::int as count
       from public.afterparty_settlements
       where afterparty_id = $1`,
      [afterpartyId]
    );

    if ((countRow?.count ?? 0) <= 1) {
      throw new Error("최소 1개의 정산이 필요합니다.");
    }

    const [target] = await tq<{ id: string }>(
      `select id
       from public.afterparty_settlements
       where id = $1
         and afterparty_id = $2`,
      [settlementId, afterpartyId]
    );

    if (target) {
      await tq(
        `delete from public.afterparty_settlements
         where id = $1
           and afterparty_id = $2`,
        [settlementId, afterpartyId]
      );
    }

    await tq(
      `delete from public.afterparty_participants p
       where p.afterparty_id = $1
         and not exists (
           select 1
           from public.afterparty_settlement_participants sp
           join public.afterparty_settlements s on s.id = sp.settlement_id
           where sp.participant_id = p.id
             and s.afterparty_id = $1
         )`,
      [afterpartyId]
    );

    const [primary] = await tq<{ id: string; settlementManager: string | null; settlementAccount: string | null }>(
      `select
         id,
         settlement_manager as "settlementManager",
         settlement_account as "settlementAccount"
       from public.afterparty_settlements
       where afterparty_id = $1
       order by sort_order asc, created_at asc, id asc
       limit 1`,
      [afterpartyId]
    );

    if (!primary) {
      throw new Error("No settlement available.");
    }

    await tq(
      `update public.afterparties
       set settlement_manager = $2,
           settlement_account = $3
       where id = $1`,
      [afterpartyId, primary.settlementManager, primary.settlementAccount]
    );

    return primary.id;
  });
}

export async function createAfterpartyParticipantsBulk(
  afterpartyId: string,
  participants: Array<string | CreateAfterpartyParticipantInput>,
  settlementId?: string
): Promise<number> {
  await ensureAfterpartySchema();

  const normalized = Array.from(
    new Map(
      participants
        .map((item) => {
          if (typeof item === "string") {
            return {
              name: item.trim(),
              role: "student" as ParticipantRole,
            };
          }
          return {
            name: item.name.trim(),
            role: item.role,
          };
        })
        .filter((item) => item.name.length > 0)
        .slice(0, 120)
        .map((item) => [item.name.toLowerCase(), item] as const)
    ).values()
  );

  if (normalized.length === 0) {
    return 0;
  }

  let insertedCount = 0;

  await withTransaction(async (tq) => {
    const targetSettlementId = await ensureTargetSettlementId(tq, afterpartyId, settlementId);

    for (const participant of normalized) {
      const name = participant.name;
      const role = participant.role;
      let participantId: string | null = null;

      const insertedParticipant = await tq<{ id: string }>(
        `insert into public.afterparty_participants (id, afterparty_id, name, role)
         select $1, $2, $3, $4
         where not exists (
           select 1
           from public.afterparty_participants
           where afterparty_id = $2
             and lower(name) = lower($3)
         )
         returning id`,
        [randomUUID(), afterpartyId, name, role]
      );

      if (insertedParticipant[0]) {
        participantId = insertedParticipant[0].id;
      } else {
        const [existingParticipant] = await tq<{ id: string; role: ParticipantRole }>(
          `select
             id,
             coalesce(nullif(role, ''), 'student') as role
           from public.afterparty_participants
           where afterparty_id = $1
             and lower(name) = lower($2)
           limit 1`,
          [afterpartyId, name]
        );
        participantId = existingParticipant?.id ?? null;

        if (
          existingParticipant &&
          existingParticipant.role !== role &&
          existingParticipant.role === "student"
        ) {
          await tq(
            `update public.afterparty_participants
             set role = $3
             where id = $1
               and afterparty_id = $2
               and role = 'student'`,
            [existingParticipant.id, afterpartyId, role]
          );
        }
      }

      if (!participantId) {
        continue;
      }

      const insertedLink = await tq<{ participantId: string }>(
        `insert into public.afterparty_settlement_participants (
           settlement_id,
           participant_id,
           is_settled,
           settled_at
         )
         values ($1, $2, false, null)
         on conflict (settlement_id, participant_id) do nothing
         returning participant_id as "participantId"`,
        [targetSettlementId, participantId]
      );

      insertedCount += insertedLink.length;
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
     where id = $1
       and afterparty_id = $2`,
    [participantId, afterpartyId]
  );
}

export async function deleteAfterpartySettlementParticipant(
  participantId: string,
  settlementId: string,
  afterpartyId: string
): Promise<void> {
  await ensureAfterpartySchema();

  await withTransaction(async (tq) => {
    await tq(
      `delete from public.afterparty_settlement_participants sp
       using public.afterparty_settlements s
       where sp.settlement_id = s.id
         and sp.participant_id = $1
         and sp.settlement_id = $2
         and s.afterparty_id = $3`,
      [participantId, settlementId, afterpartyId]
    );

    await tq(
      `delete from public.afterparty_participants p
       where p.id = $1
         and p.afterparty_id = $2
         and not exists (
           select 1
           from public.afterparty_settlement_participants sp
           join public.afterparty_settlements s on s.id = sp.settlement_id
           where sp.participant_id = p.id
             and s.afterparty_id = $2
         )`,
      [participantId, afterpartyId]
    );
  });
}

export async function updateAfterpartyParticipantSettlement(
  participantId: string,
  afterpartyId: string,
  settlementId: string | undefined,
  isSettled: boolean
): Promise<void> {
  await ensureAfterpartySchema();

  if (settlementId) {
    await query(
      `update public.afterparty_settlement_participants sp
       set is_settled = $4,
           settled_at = case when $4 then now() else null end
       from public.afterparty_settlements s
       where sp.participant_id = $1
         and sp.settlement_id = $2
         and s.id = sp.settlement_id
         and s.afterparty_id = $3`,
      [participantId, settlementId, afterpartyId, isSettled]
    );
    return;
  }

  await query(
    `update public.afterparty_settlement_participants sp
     set is_settled = $3,
         settled_at = case when $3 then now() else null end
     from public.afterparty_settlements s
     where sp.participant_id = $1
       and s.id = sp.settlement_id
       and s.afterparty_id = $2`,
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
