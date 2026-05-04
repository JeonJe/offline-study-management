#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { loadEnvFile, maskDatabaseUrl, resolvePsql } from "./lib/env-utils.mjs";

const DEFAULT_ENV_FILE = ".env.prod";
const DEFAULT_SCHEMA_FILE = "docs/db/01_init_schema.sql";

function parseArgs(argv) {
  const args = {
    envFile: DEFAULT_ENV_FILE,
    schemaFile: DEFAULT_SCHEMA_FILE,
    verifyOnly: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--verify-only") {
      args.verifyOnly = true;
    } else if (arg === "--env-file") {
      args.envFile = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === "--schema") {
      args.schemaFile = requireValue(argv, i, arg);
      i += 1;
    } else {
      throw new Error(`알 수 없는 옵션: ${arg}`);
    }
  }

  return args;
}

function requireValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} 값이 필요합니다.`);
  }
  return value;
}

function printHelp() {
  console.log(`사용: node scripts/apply-schema.mjs [options]

옵션:
  --env-file <path>  DATABASE_URL을 읽을 env 파일 (기본: ${DEFAULT_ENV_FILE})
  --schema <path>    적용할 SQL 파일 (기본: ${DEFAULT_SCHEMA_FILE})
  --verify-only      SQL 적용 없이 테이블/인덱스/RLS만 확인
  -h, --help         도움말 출력

예:
  node scripts/apply-schema.mjs --env-file .env.prod
  node scripts/apply-schema.mjs --env-file .env.prod --verify-only`);
}

function readSchema(schemaFile) {
  const resolved = path.resolve(process.cwd(), schemaFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${schemaFile} 파일을 찾을 수 없습니다.`);
  }
  return {
    resolved,
    sql: fs.readFileSync(resolved, "utf8"),
  };
}

function extractExpectedSchema(sql) {
  const tables = new Set();
  const indexes = new Set();

  for (const match of sql.matchAll(/create\s+table\s+if\s+not\s+exists\s+public\.([a-z0-9_]+)/gi)) {
    tables.add(match[1]);
  }

  for (const match of sql.matchAll(/create\s+(?:unique\s+)?index\s+if\s+not\s+exists\s+([a-z0-9_]+)/gi)) {
    indexes.add(match[1]);
  }

  return {
    tables: [...tables].sort(),
    indexes: [...indexes].sort(),
  };
}

function applySchema({ psql, databaseUrl, schemaPath }) {
  const result = spawnSync(
    psql,
    ["--dbname", databaseUrl, "--set", "ON_ERROR_STOP=1", "--file", schemaPath],
    { stdio: ["ignore", "inherit", "inherit"] }
  );

  if (result.status !== 0) {
    throw new Error(`스키마 적용 실패 (exit ${result.status ?? 1})`);
  }
}

async function verifySchema(databaseUrl, expected) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const [tablesResult, indexesResult, rlsResult] = await Promise.all([
      pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `),
      pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY indexname
      `),
      pool.query(`
        SELECT relname AS table_name, relrowsecurity AS rls_enabled
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relkind = 'r'
        ORDER BY relname
      `),
    ]);

    const actualTables = new Set(tablesResult.rows.map((row) => row.table_name));
    const actualIndexes = new Set(indexesResult.rows.map((row) => row.indexname));
    const missingTables = expected.tables.filter((table) => !actualTables.has(table));
    const missingIndexes = expected.indexes.filter((index) => !actualIndexes.has(index));
    const rlsEnabled = rlsResult.rows.filter((row) => row.rls_enabled);
    let defaultUnit;

    if (actualTables.has("operating_units")) {
      const defaultUnitResult = await pool.query(`
        SELECT slug, is_default, is_active
        FROM public.operating_units
        WHERE slug = '3기'
        LIMIT 1
      `);
      defaultUnit = defaultUnitResult.rows[0];
    }

    return {
      tables: {
        expected: expected.tables.length,
        actual: actualTables.size,
        missing: missingTables,
      },
      indexes: {
        expected: expected.indexes.length,
        actual: actualIndexes.size,
        missing: missingIndexes,
      },
      rls: {
        enabledCount: rlsEnabled.length,
        enabledTables: rlsEnabled.map((row) => row.table_name),
      },
      defaultUnit: {
        exists: Boolean(defaultUnit),
        isDefault: defaultUnit?.is_default === true,
        isActive: defaultUnit?.is_active === true,
      },
    };
  } finally {
    await pool.end();
  }
}

function failIfInvalid(report) {
  const failures = [];
  if (report.tables.missing.length > 0) {
    failures.push(`누락 테이블: ${report.tables.missing.join(", ")}`);
  }
  if (report.indexes.missing.length > 0) {
    failures.push(`누락 인덱스: ${report.indexes.missing.join(", ")}`);
  }
  if (!report.defaultUnit.exists || !report.defaultUnit.isDefault || !report.defaultUnit.isActive) {
    failures.push("기본 운영 단위 '3기' row가 기대 상태가 아닙니다.");
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error("[schema:verify]", failure);
    process.exit(1);
  }
}

function printReport(report) {
  console.log(
    "SCHEMA_VERIFY_OK",
    `tables=${report.tables.actual}/${report.tables.expected}`,
    `indexes=${report.indexes.actual}/${report.indexes.expected}`,
    `missingTables=${report.tables.missing.length}`,
    `missingIndexes=${report.indexes.missing.length}`,
    `rlsEnabled=${report.rls.enabledCount}`,
    `defaultUnit=${report.defaultUnit.exists && report.defaultUnit.isDefault && report.defaultUnit.isActive ? "ok" : "invalid"}`
  );

  if (report.rls.enabledTables.length > 0) {
    console.warn("[schema:verify] RLS enabled tables:", report.rls.enabledTables.join(", "));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  loadEnvFile(args.envFile);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const schema = readSchema(args.schemaFile);
  const expected = extractExpectedSchema(schema.sql);
  if (expected.tables.length === 0) {
    throw new Error("스키마 파일에서 public 테이블 선언을 찾지 못했습니다.");
  }

  console.log("[schema] target:", maskDatabaseUrl(databaseUrl));
  console.log("[schema] file:", path.relative(process.cwd(), schema.resolved));
  console.log("[schema] expected:", `tables=${expected.tables.length}`, `indexes=${expected.indexes.length}`);

  if (!args.verifyOnly) {
    const psql = resolvePsql();
    console.log("[schema] psql:", psql);
    applySchema({ psql, databaseUrl, schemaPath: schema.resolved });
  } else {
    console.log("[schema] verify-only: SQL 적용 생략");
  }

  const report = await verifySchema(databaseUrl, expected);
  printReport(report);
  failIfInvalid(report);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[schema] ERROR", message);
  process.exit(1);
});
