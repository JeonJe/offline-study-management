type QueryResult<T> = {
  rows: T[];
  rowCount: number;
};

type PgPool = {
  query: <T>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<T>>;
  end: () => Promise<void>;
};

const MANUAL_URL_RE =
  /^([a-z][a-z0-9+.-]*):\/\/([^:\/?#]+):([^@]+)@([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i;

let pool: PgPool | null = null;
let normalizedDatabaseUrl: string | null = null;

function requireDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is missing. Set it in .env.local or Vercel Environment Variables."
    );
  }
  return dbUrl;
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeDatabaseUrl(raw: string): string {
  const trimmed = raw.trim();

  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    // Handle raw URLs where password contains unescaped characters like #.
  }

  const match = trimmed.match(MANUAL_URL_RE);
  if (!match) {
    throw new Error(
      "DATABASE_URL format is invalid. Ensure it is a valid Postgres DSN."
    );
  }

  const scheme = match[1];
  const user = match[2];
  const password = match[3];
  const host = match[4];
  const path = match[5] ?? "/postgres";
  const query = match[6] ?? "";

  return `${scheme}://${user}:${encodeURIComponent(
    decodeSafe(password)
  )}@${host}${path}${query}`;
}

function getNormalizedDatabaseUrl(): string {
  if (normalizedDatabaseUrl) return normalizedDatabaseUrl;
  normalizedDatabaseUrl = normalizeDatabaseUrl(requireDatabaseUrl());
  return normalizedDatabaseUrl;
}

async function getPool(): Promise<PgPool> {
  if (pool) return pool;

  const { Pool } = await import("pg");
  const nextPool = new Pool({
    connectionString: getNormalizedDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

  pool = nextPool;
  return nextPool;
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = await getPool();
  const result = await client.query<T>(text, params);
  return result.rows;
}

export async function closeDbPool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}
