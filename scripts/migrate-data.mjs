#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";

const DEFAULT_TARGET_ENV_FILE = ".env.staging";
const DEFAULT_SCHEMA_FILE = "docs/db/01_init_schema.sql";

const PREFERRED_IMPORT_ORDER = [
  "operating_units",
  "afterparties",
  "afterparty_participants",
  "afterparty_settlements",
  "afterparty_settlement_participants",
  "meetings",
  "rsvps",
  "member_teams",
  "member_team_members",
  "member_angels",
  "member_special_roles",
  "weekly_report_templates",
  "weekly_report_cycles",
  "angel_weekly_reports",
  "weekly_report_comments",
];

function parseArgs(argv) {
  const args = {
    backupSql: undefined,
    sourceCounts: undefined,
    targetEnvFile: DEFAULT_TARGET_ENV_FILE,
    schemaFile: DEFAULT_SCHEMA_FILE,
    dryRun: false,
    verifyOnly: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--verify-only") {
      args.verifyOnly = true;
    } else if (arg === "--backup-sql") {
      args.backupSql = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === "--source-counts") {
      args.sourceCounts = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === "--target-env-file") {
      args.targetEnvFile = requireValue(argv, i, arg);
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
  console.log(`사용: node scripts/migrate-data.mjs [options]

옵션:
  --backup-sql <path>       scripts/backup-db.mjs가 만든 plain SQL 백업
  --source-counts <path>    백업과 함께 생성된 counts.json
  --target-env-file <path>  새 DB DATABASE_URL을 읽을 env 파일 (기본: ${DEFAULT_TARGET_ENV_FILE})
  --schema <path>           canonical schema 파일 (기본: ${DEFAULT_SCHEMA_FILE})
  --dry-run                 DB 연결 없이 import/skip 대상만 출력
  --verify-only             import 없이 target row count만 source counts와 비교
  -h, --help                도움말 출력

예:
  node scripts/migrate-data.mjs --backup-sql backups/saturday-meetup-20260501-154037.sql --source-counts backups/saturday-meetup-20260501-154037.counts.json --dry-run
  node scripts/migrate-data.mjs --target-env-file .env.staging --backup-sql backups/saturday-meetup-20260501-154037.sql --source-counts backups/saturday-meetup-20260501-154037.counts.json`);
}

function loadEnvFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${filePath} 파일을 찾을 수 없습니다.`);
  }

  const raw = fs.readFileSync(resolved, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key) process.env[key] = value;
  }
}

function resolvePsql() {
  const candidates = [
    process.env.PSQL_BIN,
    "psql",
    "/opt/homebrew/bin/psql",
    "/opt/homebrew/opt/postgresql@17/bin/psql",
    "/opt/homebrew/opt/postgresql@16/bin/psql",
    "/usr/local/opt/postgresql@17/bin/psql",
  ].filter(Boolean);

  for (const bin of candidates) {
    const result = spawnSync(bin, ["--version"], { stdio: "ignore" });
    if (result.status === 0) return bin;
  }

  throw new Error("psql 실행 파일을 찾을 수 없습니다. PostgreSQL client 설치 또는 PSQL_BIN 지정이 필요합니다.");
}

function maskDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "unparseable-database-url";
  }
}

function resolveInputFiles(args) {
  const backupSql = args.backupSql ?? findLatestBackupSql();
  const sourceCounts = args.sourceCounts ?? backupSql.replace(/\.sql$/, ".counts.json");
  return {
    backupSql: resolveExistingFile(backupSql, "backup SQL"),
    sourceCounts: resolveExistingFile(sourceCounts, "source counts"),
    schemaFile: resolveExistingFile(args.schemaFile, "schema"),
  };
}

function resolveExistingFile(filePath, label) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} 파일을 찾을 수 없습니다: ${filePath}`);
  }
  return resolved;
}

function findLatestBackupSql() {
  const backupsDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupsDir)) {
    throw new Error("backups 디렉터리가 없습니다. --backup-sql을 지정하세요.");
  }

  const candidates = fs
    .readdirSync(backupsDir)
    .filter((name) => /^saturday-meetup-\d{8}-\d{6}\.sql$/.test(name))
    .sort();

  const latest = candidates.at(-1);
  if (!latest) {
    throw new Error("plain SQL 백업을 찾지 못했습니다. --backup-sql을 지정하세요.");
  }
  return path.join(backupsDir, latest);
}

function extractCanonicalTables(schemaFile) {
  const raw = fs.readFileSync(schemaFile, "utf8");
  const tables = new Set();

  for (const match of raw.matchAll(/create\s+table\s+if\s+not\s+exists\s+public\.([a-z0-9_]+)/gi)) {
    tables.add(match[1]);
  }

  return tables;
}

function readSourceCounts(countsFile) {
  const parsed = JSON.parse(fs.readFileSync(countsFile, "utf8"));
  const rowCounts = parsed.rowCounts;
  if (!rowCounts || typeof rowCounts !== "object") {
    throw new Error("counts.json에서 rowCounts를 찾지 못했습니다.");
  }
  return rowCounts;
}

function extractCopyBlocks(backupSqlFile) {
  const lines = fs.readFileSync(backupSqlFile, "utf8").split(/\r?\n/);
  const blocks = new Map();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^COPY public\.([a-z0-9_]+) \(.+\) FROM stdin;$/);
    if (!match) continue;

    const table = match[1];
    const block = [line];
    i += 1;

    while (i < lines.length) {
      block.push(lines[i]);
      if (lines[i] === "\\.") break;
      i += 1;
    }

    if (block.at(-1) !== "\\.") {
      throw new Error(`COPY block이 닫히지 않았습니다: public.${table}`);
    }

    blocks.set(table, block.join("\n"));
  }

  return blocks;
}

function planImport({ canonicalTables, copyBlocks, sourceCounts }) {
  const backupTables = [...copyBlocks.keys()].sort();
  const importSet = new Set(backupTables.filter((table) => canonicalTables.has(table)));
  const canonicalSet = new Set(canonicalTables);
  const orderedManagedTables = [
    ...PREFERRED_IMPORT_ORDER.filter((table) => canonicalSet.has(table)),
    ...[...canonicalSet].filter((table) => !PREFERRED_IMPORT_ORDER.includes(table)).sort(),
  ];
  const orderedImportTables = [
    ...PREFERRED_IMPORT_ORDER.filter((table) => importSet.has(table)),
    ...[...importSet].filter((table) => !PREFERRED_IMPORT_ORDER.includes(table)).sort(),
  ];

  const skippedTables = backupTables.filter((table) => !canonicalTables.has(table));
  const missingCopyTables = [...canonicalTables].filter((table) => !copyBlocks.has(table)).sort();
  const sourceCountTables = Object.keys(sourceCounts)
    .filter((key) => key.startsWith("public."))
    .map((key) => key.slice("public.".length))
    .sort();
  const skippedCountTables = sourceCountTables.filter((table) => !canonicalTables.has(table));

  return {
    managedTables: orderedManagedTables,
    importTables: orderedImportTables,
    skippedTables,
    skippedCountTables,
    missingCopyTables,
  };
}

function quoteTableList(tables) {
  return tables.map((table) => `public.${table}`).join(", ");
}

function buildImportSql({ managedTables, importTables, copyBlocks }) {
  const chunks = [
    "\\set ON_ERROR_STOP on",
    "BEGIN;",
    `TRUNCATE ${quoteTableList(managedTables)} RESTART IDENTITY CASCADE;`,
    "",
  ];

  for (const table of importTables) {
    chunks.push(copyBlocks.get(table), "");
  }

  chunks.push("COMMIT;", "");
  return chunks.join("\n");
}

function runImport({ psql, databaseUrl, importSql }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "saturday-meetup-migrate-"));
  const tempFile = path.join(tempDir, "import-public-data.sql");
  fs.writeFileSync(tempFile, importSql);

  try {
    const result = spawnSync(
      psql,
      ["--dbname", databaseUrl, "--set", "ON_ERROR_STOP=1", "--file", tempFile],
      { stdio: ["ignore", "inherit", "inherit"] }
    );

    if (result.status !== 0) {
      throw new Error(`데이터 import 실패 (exit ${result.status ?? 1})`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function collectTargetCounts(databaseUrl, tables) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const counts = {};
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*)::bigint AS count FROM public.${table}`);
      counts[`public.${table}`] = Number(result.rows[0]?.count ?? 0);
    }
    return counts;
  } finally {
    await pool.end();
  }
}

function compareCounts({ sourceCounts, targetCounts, importTables }) {
  const rows = importTables.map((table) => {
    const key = `public.${table}`;
    const source = Number(sourceCounts[key] ?? 0);
    const target = Number(targetCounts[key] ?? 0);
    return {
      table: key,
      source,
      target,
      diff: target - source,
    };
  });

  return {
    rows,
    mismatches: rows.filter((row) => row.diff !== 0),
  };
}

function printPlan({ files, plan }) {
  console.log("[migrate] backup:", path.relative(process.cwd(), files.backupSql));
  console.log("[migrate] counts:", path.relative(process.cwd(), files.sourceCounts));
  console.log("[migrate] managedTables:", plan.managedTables.length);
  console.log("[migrate] importTables:", plan.importTables.length);
  console.log("[migrate] skippedBackupTables:", plan.skippedTables.join(", ") || "none");
  console.log("[migrate] skippedCountTables:", plan.skippedCountTables.join(", ") || "none");
  console.log("[migrate] missingCopyTables:", plan.missingCopyTables.join(", ") || "none");
}

function printCompare(compare) {
  for (const row of compare.rows) {
    console.log("COUNT_COMPARE", row.table, `source=${row.source}`, `target=${row.target}`, `diff=${row.diff}`);
  }
}

function failIfUnsafePlan(plan) {
  if (plan.managedTables.length === 0) {
    throw new Error("관리 대상 public 테이블이 없습니다.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const files = resolveInputFiles(args);
  const canonicalTables = extractCanonicalTables(files.schemaFile);
  const sourceCounts = readSourceCounts(files.sourceCounts);
  const copyBlocks = extractCopyBlocks(files.backupSql);
  const plan = planImport({ canonicalTables, copyBlocks, sourceCounts });

  printPlan({ files, plan });
  failIfUnsafePlan(plan);

  if (args.dryRun) {
    console.log("MIGRATE_DRY_RUN_OK", `managedTables=${plan.managedTables.length}`, `importTables=${plan.importTables.length}`);
    return;
  }

  loadEnvFile(args.targetEnvFile);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  console.log("[migrate] target:", maskDatabaseUrl(databaseUrl));

  if (!args.verifyOnly) {
    const psql = resolvePsql();
    const importSql = buildImportSql({
      managedTables: plan.managedTables,
      importTables: plan.importTables,
      copyBlocks,
    });
    console.log("[migrate] psql:", psql);
    runImport({ psql, databaseUrl, importSql });
  } else {
    console.log("[migrate] verify-only: import 생략");
  }

  const targetCounts = await collectTargetCounts(databaseUrl, plan.managedTables);
  const compare = compareCounts({ sourceCounts, targetCounts, importTables: plan.managedTables });
  printCompare(compare);

  if (compare.mismatches.length > 0) {
    for (const row of compare.mismatches) {
      console.error("[migrate] COUNT_MISMATCH", row.table, `source=${row.source}`, `target=${row.target}`, `diff=${row.diff}`);
    }
    process.exit(1);
  }

  console.log("MIGRATE_VERIFY_OK", `tables=${compare.rows.length}`, "mismatches=0");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[migrate] ERROR", message);
  process.exit(1);
});
