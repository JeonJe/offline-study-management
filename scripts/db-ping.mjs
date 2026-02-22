#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

function loadEnvFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return;

  const raw = fs.readFileSync(resolved, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

let hostForDisplay = "unknown";
try {
  const parsedUrl = new URL(databaseUrl);
  hostForDisplay = parsedUrl.hostname || "unknown";
} catch {
  const manualHostMatch = databaseUrl.match(/@([^:/?#]+)(?::\d+|\/|\?|#|$)/);
  if (manualHostMatch?.[1]) hostForDisplay = manualHostMatch[1];
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  const result = await pool.query("SELECT NOW() AS now, VERSION() as version");
  const row = result.rows[0];
  console.log("DB_OK", row?.now, row?.version?.slice(0, 40));
} catch (error) {
  const errorCode = typeof error === "object" && error !== null ? error.code : undefined;
  const errorHostname =
    typeof error === "object" && error !== null ? error.hostname : undefined;

  if (errorCode === "ENOTFOUND") {
    const dnsHost = errorHostname ?? hostForDisplay;
    console.error(
      "DB_ERROR",
      "ENOTFOUND",
      `Could not resolve host: ${dnsHost}`
    );
    console.error(
      "HINT",
      "Run this command on your local machine (not this sandbox), or verify host name in Supabase dashboard: Connection string > host field."
    );
    process.exit(1);
  }

  const code = errorCode ?? "UNKNOWN";
  const message = error instanceof Error ? error.message : String(error);
  console.error("DB_ERROR", code, message);
  process.exit(1);
} finally {
  await pool.end();
}
