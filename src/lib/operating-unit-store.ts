import { query } from "@/lib/db";

export const LEGACY_OPERATING_UNIT_SLUG = "default";
export const DEFAULT_OPERATING_UNIT_SLUG = "3기";
export const DEFAULT_OPERATING_UNIT_NAME = "3기";

export type OperatingUnit = {
  slug: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export function _resetSchemaStateForTesting(): void {
  schemaReady = false;
  schemaPromise = null;
}

export async function ensureOperatingUnitSchema(): Promise<void> {
  if (schemaReady || process.env.SKIP_SCHEMA_CHECK === "1") return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await query(
      `create table if not exists public.operating_units (
         slug text primary key,
         name text not null,
         description text,
         is_default boolean not null default false,
         is_active boolean not null default true,
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       )`
    );

    await query(
      `alter table public.operating_units
       add column if not exists is_active boolean not null default true`
    );

    await query(
      `create unique index if not exists idx_operating_units_single_default
       on public.operating_units (is_default)
       where is_default`
    );

    await query(
      `insert into public.operating_units (slug, name, is_default)
       values ($1, $2, false)
       on conflict (slug)
       do update set
         is_active = true,
         is_default = false,
         updated_at = now()`,
      [LEGACY_OPERATING_UNIT_SLUG, "기존 데이터"]
    );

    await query(
      `insert into public.operating_units (slug, name, is_default)
       values ($1, $2, true)
       on conflict (slug)
       do update set
         name = coalesce(nullif(public.operating_units.name, ''), excluded.name),
         is_active = true,
         is_default = true,
         updated_at = now()`,
      [DEFAULT_OPERATING_UNIT_SLUG, DEFAULT_OPERATING_UNIT_NAME]
    );

    await query(
      `update public.operating_units
       set is_default = false,
           is_active = true,
           updated_at = now()
       where slug = $1
          or (slug <> $2 and is_default)`,
      [LEGACY_OPERATING_UNIT_SLUG, DEFAULT_OPERATING_UNIT_SLUG]
    );

    schemaReady = true;
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

export async function ensureOperatingUnitColumn(
  tableName: string,
  indexName: string
): Promise<void> {
  assertSqlIdentifier(tableName);
  assertSqlIdentifier(indexName);
  await ensureOperatingUnitSchema();

  await query(
    `alter table public.${tableName}
     add column if not exists operating_unit_slug text not null default '${DEFAULT_OPERATING_UNIT_SLUG}'`
  );

  await query(
    `alter table public.${tableName}
     alter column operating_unit_slug set default '${DEFAULT_OPERATING_UNIT_SLUG}'`
  );

  await query(
    `update public.${tableName}
     set operating_unit_slug = $1
     where operating_unit_slug is null
        or btrim(operating_unit_slug) = ''
        or operating_unit_slug = $2`,
    [DEFAULT_OPERATING_UNIT_SLUG, LEGACY_OPERATING_UNIT_SLUG]
  );

  await query(
    `create index if not exists ${indexName}
     on public.${tableName} (operating_unit_slug)`
  );
}

export async function listOperatingUnits(): Promise<OperatingUnit[]> {
  await ensureOperatingUnitSchema();

  return query<OperatingUnit>(
    `select
       slug,
       name,
       description,
       is_default as "isDefault",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     from public.operating_units
     order by is_default desc, is_active desc, created_at asc, slug asc`
  );
}

export async function getOperatingUnit(
  slug: string
): Promise<OperatingUnit | null> {
  await ensureOperatingUnitSchema();

  const normalizedSlug = normalizeOperatingUnitSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const [unit] = await query<OperatingUnit>(
    `select
       slug,
       name,
       description,
       is_default as "isDefault",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     from public.operating_units
     where slug = $1
     limit 1`,
    [normalizedSlug]
  );

  return unit ?? null;
}

export async function createOperatingUnit(input: {
  slug: string;
  name: string;
  description?: string;
}): Promise<OperatingUnit> {
  await ensureOperatingUnitSchema();

  const slug = normalizeOperatingUnitSlug(input.slug);
  const name = input.name.trim();
  if (!slug || !name) {
    throw new Error("운영 단위 이름과 식별자가 필요합니다.");
  }

  const [created] = await query<OperatingUnit>(
    `insert into public.operating_units (slug, name, description)
     values ($1, $2, nullif($3, ''))
     on conflict (slug) do nothing
     returning
       slug,
       name,
       description,
       is_default as "isDefault",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    [slug, name, input.description?.trim() ?? ""]
  );

  if (!created) {
    throw new Error("이미 존재하는 운영 단위 식별자입니다.");
  }
  return created;
}

export async function updateOperatingUnit(input: {
  slug: string;
  name: string;
  description?: string;
  isActive: boolean;
}): Promise<OperatingUnit> {
  await ensureOperatingUnitSchema();

  const slug = normalizeOperatingUnitSlug(input.slug);
  const name = input.name.trim();
  if (!slug || !name) {
    throw new Error("운영 단위 이름과 식별자가 필요합니다.");
  }

  const isProtectedDefault = isProtectedOperatingUnitSlug(slug);
  const nextIsActive = isProtectedDefault ? true : input.isActive;

  const [updated] = await query<OperatingUnit>(
    `update public.operating_units
     set name = $2,
         description = nullif($3, ''),
         is_active = $4,
         updated_at = now()
     where slug = $1
     returning
       slug,
       name,
       description,
       is_default as "isDefault",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    [slug, name, input.description?.trim() ?? "", nextIsActive]
  );

  if (!updated) {
    throw new Error("운영 단위를 수정하지 못했습니다.");
  }
  return updated;
}

export async function assertOperatingUnitAcceptsNewData(slug: string): Promise<void> {
  const unit = await getOperatingUnit(slug || DEFAULT_OPERATING_UNIT_SLUG);
  if (!unit) {
    throw new Error("운영 단위를 찾을 수 없습니다.");
  }
  if (!unit.isActive) {
    throw new Error("비활성 운영 단위에는 새 데이터를 등록할 수 없습니다.");
  }
}

export function isProtectedOperatingUnitSlug(slug: string): boolean {
  const normalizedSlug = normalizeOperatingUnitSlug(slug);
  return normalizedSlug === LEGACY_OPERATING_UNIT_SLUG || normalizedSlug === DEFAULT_OPERATING_UNIT_SLUG;
}

export function normalizeOperatingUnitSlug(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === DEFAULT_OPERATING_UNIT_SLUG) {
    return DEFAULT_OPERATING_UNIT_SLUG;
  }

  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function assertSqlIdentifier(value: string): void {
  if (/^[a-z_][a-z0-9_]*$/i.test(value)) return;
  throw new Error(`Invalid SQL identifier: ${value}`);
}
