type QueryResult<T> = {
  rows: T[];
  rowCount: number;
};

type PgClient = {
  query: <T>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
  release: () => void;
};

type PgPool = {
  query: <T>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
  connect: () => Promise<PgClient>;
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
  const queryStr = match[6] ?? "";

  return `${scheme}://${user}:${encodeURIComponent(
    decodeSafe(password)
  )}@${host}${path}${queryStr}`;
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
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

  pool = nextPool as unknown as PgPool;
  return pool;
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = await getPool();
  const result = await client.query<T>(text, params);
  return result.rows;
}

export async function withTransaction<T>(
  fn: (tq: <R>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
): Promise<T> {
  const pgPool = await getPool();
  const client = await pgPool.connect();

  try {
    await client.query("BEGIN");

    const tq = async <R>(text: string, params: unknown[] = []): Promise<R[]> => {
      const result = await client.query<R>(text, params);
      return result.rows;
    };

    const result = await fn(tq);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDbPool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}
