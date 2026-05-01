import { createHash, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";

export const LEGACY_OPERATING_UNIT_SLUG = "default";
export const OLD_DEFAULT_OPERATING_UNIT_SLUG = "3기";
export const DEFAULT_OPERATING_UNIT_SLUG = "loop-pak-3";
export const DEFAULT_OPERATING_UNIT_NAME = "3기";

export type OperatingUnit = {
  slug: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  hasAccessPassword: boolean;
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
      `alter table public.operating_units
       add column if not exists access_password_hash text`
    );

    await query(
      `create unique index if not exists idx_operating_units_single_default
       on public.operating_units (is_default)
       where is_default`
    );

    await query(
      `update public.operating_units
       set slug = $1,
           name = coalesce(nullif(name, ''), $2),
           is_default = true,
           is_active = true,
           updated_at = now()
       where slug = $3
         and not exists (
           select 1 from public.operating_units where slug = $1
         )`,
      [DEFAULT_OPERATING_UNIT_SLUG, DEFAULT_OPERATING_UNIT_NAME, OLD_DEFAULT_OPERATING_UNIT_SLUG]
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
          or slug = $2
          or (slug <> $3 and is_default)`,
      [LEGACY_OPERATING_UNIT_SLUG, OLD_DEFAULT_OPERATING_UNIT_SLUG, DEFAULT_OPERATING_UNIT_SLUG]
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
        or operating_unit_slug = $2
        or operating_unit_slug = $3`,
    [DEFAULT_OPERATING_UNIT_SLUG, LEGACY_OPERATING_UNIT_SLUG, OLD_DEFAULT_OPERATING_UNIT_SLUG]
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
       (access_password_hash is not null) as "hasAccessPassword",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     from public.operating_units
     where slug <> $1
     order by is_default desc, is_active desc, created_at asc, slug asc`,
    [LEGACY_OPERATING_UNIT_SLUG]
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
       (access_password_hash is not null) as "hasAccessPassword",
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
  accessPassword?: string;
}): Promise<OperatingUnit> {
  await ensureOperatingUnitSchema();

  const slug = normalizeOperatingUnitSlug(input.slug);
  const name = input.name.trim();
  if (!slug || !name) {
    throw new Error("이름과 주소 식별자가 필요합니다.");
  }
  const accessPassword = input.accessPassword
    ? normalizeAccessPassword(input.accessPassword)
    : "";

  const [created] = await query<OperatingUnit>(
    `insert into public.operating_units (slug, name, description, access_password_hash)
     values ($1, $2, nullif($3, ''), $4)
     on conflict (slug) do nothing
     returning
       slug,
       name,
       description,
       is_default as "isDefault",
       is_active as "isActive",
       (access_password_hash is not null) as "hasAccessPassword",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    [
      slug,
      name,
      input.description?.trim() ?? "",
      accessPassword ? makeOperatingUnitAccessHash(slug, accessPassword) : null,
    ]
  );

  if (!created) {
    throw new Error("이미 존재하는 주소 식별자입니다.");
  }
  return created;
}

export async function updateOperatingUnit(input: {
  slug: string;
  name: string;
  description?: string;
}): Promise<OperatingUnit> {
  await ensureOperatingUnitSchema();

  const slug = normalizeOperatingUnitSlug(input.slug);
  const name = input.name.trim();
  if (!slug || !name) {
    throw new Error("이름과 주소 식별자가 필요합니다.");
  }

  const [updated] = await query<OperatingUnit>(
    `update public.operating_units
     set name = $2,
         description = nullif($3, ''),
         updated_at = now()
     where slug = $1
     returning
       slug,
       name,
       description,
       is_default as "isDefault",
       is_active as "isActive",
       (access_password_hash is not null) as "hasAccessPassword",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    [slug, name, input.description?.trim() ?? ""]
  );

  if (!updated) {
    throw new Error("항목을 수정하지 못했습니다.");
  }
  return updated;
}

export async function assertOperatingUnitAcceptsNewData(slug: string): Promise<void> {
  const unit = await getOperatingUnit(slug || DEFAULT_OPERATING_UNIT_SLUG);
  if (!unit) {
    throw new Error("항목을 찾을 수 없습니다.");
  }
  if (!unit.isActive) {
    throw new Error("비활성 항목에는 새 데이터를 등록할 수 없습니다.");
  }
}

export async function createOperatingUnitAccessToken(
  slug: string,
  password: string
): Promise<string | null> {
  const normalizedSlug = normalizeOperatingUnitSlug(slug);
  const normalizedPassword = normalizeAccessPassword(password);
  if (!normalizedSlug || !normalizedPassword) {
    return null;
  }

  const token = makeOperatingUnitAccessHash(normalizedSlug, normalizedPassword);
  if (await verifyOperatingUnitAccessToken(normalizedSlug, token)) {
    return token;
  }
  return null;
}

export async function verifyOperatingUnitAccessCode(
  slug: string,
  password: string
): Promise<boolean> {
  return (await createOperatingUnitAccessToken(slug, password)) !== null;
}

export async function verifyOperatingUnitAccessToken(
  slug: string,
  token: string
): Promise<boolean> {
  await ensureOperatingUnitSchema();

  const normalizedSlug = normalizeOperatingUnitSlug(slug);
  const normalizedToken = token.trim();
  if (!normalizedSlug || !normalizedToken) {
    return false;
  }

  const [row] = await query<{ accessPasswordHash: string | null; isActive: boolean }>(
    `select
       access_password_hash as "accessPasswordHash",
       is_active as "isActive"
     from public.operating_units
     where slug = $1
     limit 1`,
    [normalizedSlug]
  );

  if (!row?.isActive) {
    return false;
  }

  const expectedToken =
    row.accessPasswordHash ?? fallbackOperatingUnitAccessHash(normalizedSlug);
  if (!expectedToken) {
    return false;
  }

  return safeEquals(normalizedToken, expectedToken);
}

export async function setOperatingUnitAccessCode(input: {
  slug: string;
  password: string;
}): Promise<void> {
  await ensureOperatingUnitSchema();

  const slug = normalizeOperatingUnitSlug(input.slug);
  const password = normalizeAccessPassword(input.password);
  if (!slug || !password) {
    throw new Error("입장 코드가 필요합니다.");
  }

  const updated = await query<{ slug: string }>(
    `update public.operating_units
     set access_password_hash = $2,
         updated_at = now()
     where slug = $1
     returning slug`,
    [slug, makeOperatingUnitAccessHash(slug, password)]
  );

  if (!updated[0]) {
    throw new Error("입장 코드를 변경하지 못했습니다.");
  }
}

export function isProtectedOperatingUnitSlug(slug: string): boolean {
  const normalizedSlug = normalizeOperatingUnitSlug(slug);
  return normalizedSlug === LEGACY_OPERATING_UNIT_SLUG || normalizedSlug === DEFAULT_OPERATING_UNIT_SLUG;
}

export function normalizeOperatingUnitSlug(raw: string): string {
  const trimmed = safeDecode(raw.trim());
  if (trimmed === OLD_DEFAULT_OPERATING_UNIT_SLUG || trimmed === encodeURIComponent(OLD_DEFAULT_OPERATING_UNIT_SLUG)) {
    return DEFAULT_OPERATING_UNIT_SLUG;
  }
  if (trimmed === DEFAULT_OPERATING_UNIT_SLUG) {
    return DEFAULT_OPERATING_UNIT_SLUG;
  }

  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function assertSqlIdentifier(value: string): void {
  if (/^[a-z_][a-z0-9_]*$/i.test(value)) return;
  throw new Error(`Invalid SQL identifier: ${value}`);
}

function normalizeAccessPassword(password: string): string {
  return password.trim();
}

function makeOperatingUnitAccessHash(slug: string, password: string): string {
  return createHash("sha256")
    .update(`saturday-meetup:operating-unit:${slug}:${password}`)
    .digest("hex");
}

function fallbackOperatingUnitAccessHash(slug: string): string | null {
  const appPassword = process.env.APP_PASSWORD?.trim();
  if (!appPassword) {
    return null;
  }
  return makeOperatingUnitAccessHash(slug, appPassword);
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
