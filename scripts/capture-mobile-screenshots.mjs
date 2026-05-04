#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const VIEWPORT = { width: 390, height: 844 };
const DEFAULT_OUTPUT_DIR = "test-results/mobile-screenshots";

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || process.env[key]) continue;
    process.env[key] = rest.join("=").replace(/^['"]|['"]$/g, "");
  }
}

function authToken(password) {
  return createHash("sha256")
    .update(`saturday-meetup:${password}`)
    .digest("hex");
}

function unitAuthToken(slug, password) {
  return createHash("sha256")
    .update(`saturday-meetup:operating-unit:${slug}:${password}`)
    .digest("hex");
}

function unitRoleToken(slug, role, password) {
  return createHash("sha256")
    .update(`saturday-meetup:operating-unit:${slug}:${role}:${password}`)
    .digest("hex");
}

function cookieDomain(baseUrl) {
  const url = new URL(baseUrl);
  return {
    domain: url.hostname,
    secure: url.protocol === "https:",
  };
}

async function collectSignals(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };

    const controls = Array.from(document.querySelectorAll("input, select, textarea"))
      .filter((element) => !["hidden", "submit", "button"].includes(element.getAttribute("type") ?? ""))
      .filter(visible);
    const unlabeledControls = controls.filter((element) => {
      const id = element.getAttribute("id");
      const hasForLabel = id ? Boolean(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : false;
      return element.labels?.length === 0 && !hasForLabel && !element.getAttribute("aria-label");
    }).length;

    const imagesMissingAlt = Array.from(document.querySelectorAll("img"))
      .filter(visible)
      .filter((element) => !element.hasAttribute("alt"))
      .length;

    const focusable = Array.from(document.querySelectorAll("a[href], button, input, select, textarea, [tabindex]"))
      .filter((element) => !element.hasAttribute("disabled"))
      .filter((element) => element.getAttribute("tabindex") !== "-1")
      .filter(visible);

    const boxes = Array.from(document.querySelectorAll("a[href], button, input, select, textarea"))
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? element.getAttribute("aria-label") ?? "").trim().slice(0, 40),
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          area: rect.width * rect.height,
        };
      })
      .filter((box) => box.area > 20);

    let overlapCount = 0;
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width <= 0 || height <= 0) continue;
        const overlapArea = width * height;
        if (overlapArea > Math.min(a.area, b.area) * 0.65) {
          overlapCount += 1;
        }
      }
    }

    return {
      title: document.title,
      focusableCount: focusable.length,
      unlabeledControls,
      imagesMissingAlt,
      overlapCount,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const baseUrl = argValue("--base-url", process.env.PLAYWRIGHT_BASE_URL ?? "https://offline-study-management.vercel.app");
  const outputDir = argValue("--output-dir", DEFAULT_OUTPUT_DIR);
  const unitSlug = argValue("--unit", process.env.TEST_OPERATING_UNIT_SLUG ?? "loop-pak-3");
  const appPassword = process.env.APP_PASSWORD;
  const unitAccessCode = process.env.TEST_OPERATING_UNIT_ACCESS_CODE;
  const unitAdminCode = process.env.TEST_OPERATING_UNIT_ADMIN_CODE;
  const unitAngelCode = process.env.TEST_OPERATING_UNIT_ANGEL_CODE;

  if (!appPassword || !unitAccessCode || !unitAdminCode || !unitAngelCode) {
    throw new Error(
      "APP_PASSWORD, TEST_OPERATING_UNIT_ACCESS_CODE, TEST_OPERATING_UNIT_ADMIN_CODE, TEST_OPERATING_UNIT_ANGEL_CODE 환경변수가 필요합니다."
    );
  }

  const routes = [
    { name: "home", path: "/" },
    { name: "cohort-entry", path: `/cohorts/${unitSlug}/entry` },
    { name: "study", path: `/cohorts/${unitSlug}/study`, unit: true },
    { name: "angel", path: `/cohorts/${unitSlug}/angel`, unit: true, role: "angel" },
    { name: "admin", path: `/cohorts/${unitSlug}/admin`, unit: true, role: "admin" },
    { name: "members", path: `/cohorts/${unitSlug}/members`, unit: true, role: "admin" },
    { name: "admin-reports", path: `/cohorts/${unitSlug}/admin/reports`, unit: true, role: "admin" },
    { name: "admin-history", path: `/cohorts/${unitSlug}/admin/history`, unit: true, role: "admin" },
    { name: "admin-operating-units", path: "/admin/operating-units", globalAdmin: true },
  ];

  fs.mkdirSync(outputDir, { recursive: true });
  const { domain, secure } = cookieDomain(baseUrl);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
  });

  const page = await context.newPage();
  const results = [];

  for (const route of routes) {
    const cookies = [];
    if (route.globalAdmin) {
      cookies.push({
        name: "meetup_auth",
        value: authToken(appPassword),
        domain,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure,
      });
    }
    if (route.unit) {
      cookies.push({
        name: "meetup_auth",
        value: `unit:${encodeURIComponent(unitSlug)}:${unitAuthToken(unitSlug, unitAccessCode)}`,
        domain,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure,
      });
    }
    if (route.role) {
      const password = route.role === "admin" ? unitAdminCode : unitAngelCode;
      cookies.push({
        name: "meetup_role_access",
        value: `${route.role}.${encodeURIComponent(unitSlug)}.${unitRoleToken(unitSlug, route.role, password)}`,
        domain,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure,
      });
    }
    if (cookies.length > 0) await context.addCookies(cookies);
    await page.goto(route.path, { waitUntil: "networkidle" });
    const screenshotPath = path.join(outputDir, `${route.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const signals = await collectSignals(page);
    results.push({
      route: route.path,
      screenshot: screenshotPath,
      ...signals,
    });
  }

  const reportPath = path.join(outputDir, "summary.json");
  fs.writeFileSync(reportPath, `${JSON.stringify({
    baseUrl,
    viewport: VIEWPORT,
    capturedAt: new Date().toISOString(),
    results,
  }, null, 2)}\n`);

  await browser.close();
  console.log(`Captured ${results.length} mobile screenshots into ${outputDir}`);
  console.log(`Summary: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
