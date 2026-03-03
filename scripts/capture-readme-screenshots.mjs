#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import pg from "pg";

const { Pool } = pg;

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

function normalizeName(name) {
  return String(name ?? "").trim();
}

async function collectNameMap(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const names = new Set();

  async function collect(sql, field) {
    try {
      const result = await pool.query(sql);
      for (const row of result.rows) {
        const value = normalizeName(row[field]);
        if (!value) continue;
        names.add(value);
      }
    } catch {
      // Ignore missing tables/columns.
    }
  }

  await collect(`select member_name as name from public.member_team_members`, "name");
  await collect(`select angel_name as name from public.member_angels`, "name");
  await collect(`select member_name as name from public.member_special_roles`, "name");
  await collect(`select name from public.rsvps`, "name");
  await collect(`select name from public.afterparty_participants`, "name");
  await collect(`select settlement_manager as name from public.afterparty_settlements`, "name");

  try {
    const result = await pool.query(`select angel_names from public.member_teams`);
    for (const row of result.rows) {
      const angels = Array.isArray(row.angel_names) ? row.angel_names : [];
      for (const angel of angels) {
        const value = normalizeName(angel);
        if (!value) continue;
        names.add(value);
      }
    }
  } catch {
    // Ignore missing table/column.
  }

  await pool.end();

  const sortedNames = [...names].sort((a, b) => a.localeCompare(b, "ko"));
  const mapping = {};
  sortedNames.forEach((name, index) => {
    mapping[name] = `샘플인원${String(index + 1).padStart(2, "0")}`;
  });

  return mapping;
}

async function ensureStudyMeeting(page) {
  const meetingLink = page.locator('a[href^="/meetings/"]').first();
  if ((await meetingLink.count()) > 0) return;

  const details = page.locator("details", { has: page.locator('input[name="title"]') }).first();
  await details.evaluate((el) => el.setAttribute("open", ""));

  const isoDate = new Date().toISOString().slice(0, 10);
  await page.locator('input[name="title"]').fill("README 샘플 스터디");
  await page.locator('input[name="meetingDate"]').fill(isoDate);
  await page.locator('input[name="startTime"]').fill("14:00");
  await page.locator('input[name="location"]').fill("샘플 스터디 라운지");
  await page.locator('input[name="description"]').fill("README 스크린샷용 샘플 모임");

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    page.locator('button[type="submit"]', { hasText: "생성" }).first().click(),
  ]);
}

async function ensureAfterparty(page) {
  const detailLink = page.locator('a[href^="/afterparty/"]').first();
  if ((await detailLink.count()) > 0) return;

  const details = page.locator("details", { has: page.locator('input[name="eventDate"]') }).first();
  await details.evaluate((el) => el.setAttribute("open", ""));

  const isoDate = new Date().toISOString().slice(0, 10);
  await page.locator('input[name="title"]').fill("README 샘플 뒷풀이");
  await page.locator('input[name="eventDate"]').fill(isoDate);
  await page.locator('input[name="startTime"]').fill("19:00");
  await page.locator('input[name="location"]').fill("샘플 다이닝 공간");
  await page.locator('input[name="description"]').fill("README 스크린샷용 샘플 뒷풀이");

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    page.locator('button[type="submit"]', { hasText: "생성" }).first().click(),
  ]);
}

async function anonymizePage(page, mapping) {
  await page.evaluate((nameMap) => {
    const entries = Object.entries(nameMap).sort((a, b) => b[0].length - a[0].length);

    function replaceNames(text) {
      let out = text;
      for (const [original, alias] of entries) {
        if (original && out.includes(original)) {
          out = out.split(original).join(alias);
        }
      }

      out = out
        .replace(/(계좌\s*[:：]\s*)([^\n]+)/g, "$1토스 0000-0000-0000")
        .replace(/(정산자\s*[:：]\s*)([^\n]+)/g, "$1샘플정산자")
        .replace(/(Mentor:\s*)([^\n+]+)/g, "$1Sample Mentor");

      return out;
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node);
      node = walker.nextNode();
    }

    for (const textNode of textNodes) {
      const current = textNode.nodeValue ?? "";
      const next = replaceNames(current);
      if (next !== current) {
        textNode.nodeValue = next;
      }
    }

    const inputs = document.querySelectorAll("input, textarea");
    for (const input of inputs) {
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) continue;
      if (input.value) {
        input.value = replaceNames(input.value);
      }
    }
  }, mapping);
}

async function take(page, filePath, mapping) {
  await page.waitForLoadState("networkidle");
  await anonymizePage(page, mapping);
  await page.waitForTimeout(200);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`captured: ${filePath}`);
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";
  const password = process.env.APP_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  if (!password) {
    throw new Error("APP_PASSWORD 환경변수가 필요합니다.");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 환경변수가 필요합니다.");
  }

  await fs.promises.mkdir("docs/screenshots", { recursive: true });
  const nameMap = await collectNameMap(databaseUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  await page.goto(baseURL, { waitUntil: "networkidle" });
  const passwordInput = page.locator('input[name="password"]');
  if ((await passwordInput.count()) > 0) {
    await passwordInput.fill(password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }),
      page.locator('button[type="submit"]').click(),
    ]);
  }

  await ensureStudyMeeting(page);
  await take(page, "docs/screenshots/study-dashboard-sample.png", nameMap);

  const meetingLink = page.locator('a[href^="/meetings/"]').first();
  if ((await meetingLink.count()) > 0) {
    await Promise.all([
      page.waitForURL(/\/meetings\//),
      meetingLink.click(),
    ]);
    await take(page, "docs/screenshots/study-detail-sample.png", nameMap);
  }

  await page.goto(`${baseURL}/afterparty`, { waitUntil: "networkidle" });
  await ensureAfterparty(page);
  await take(page, "docs/screenshots/afterparty-dashboard-sample.png", nameMap);

  const afterpartyDetailLink = page.locator('a[href^="/afterparty/"]').first();
  if ((await afterpartyDetailLink.count()) > 0) {
    await Promise.all([
      page.waitForURL(/\/afterparty\//),
      afterpartyDetailLink.click(),
    ]);
    await take(page, "docs/screenshots/afterparty-detail-sample.png", nameMap);
  }

  await page.goto(`${baseURL}/members`, { waitUntil: "networkidle" });
  await take(page, "docs/screenshots/members-sample.png", nameMap);

  await browser.close();
}

await main();
