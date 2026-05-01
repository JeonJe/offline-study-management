#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const VIEWPORT = { width: 390, height: 844 };
const DEFAULT_OUTPUT_DIR = "test-results/mobile-screenshots";
const ROUTES = [
  { name: "home", path: "/" },
  { name: "member", path: "/member" },
  { name: "angel", path: "/angel", role: "angel" },
  { name: "admin", path: "/admin", role: "admin" },
  { name: "admin-operating-units", path: "/admin/operating-units", role: "admin" },
  { name: "admin-reports", path: "/admin/reports", role: "admin" },
  { name: "admin-history", path: "/admin/history", role: "admin" },
];

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

function roleToken(role, password) {
  return createHash("sha256")
    .update(`saturday-meetup:${role}:${password}`)
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
  loadEnvFile("/Users/green/IdeaProjects/saturday-meetup/.env");
  loadEnvFile("/Users/green/IdeaProjects/saturday-meetup/.env.local");

  const baseUrl = argValue("--base-url", process.env.PLAYWRIGHT_BASE_URL ?? "https://offline-study-management.vercel.app");
  const outputDir = argValue("--output-dir", DEFAULT_OUTPUT_DIR);
  const appPassword = process.env.APP_PASSWORD;
  const adminPassword = process.env.ADMIN_PAGE_PASSWORD;
  const angelPassword = process.env.ANGEL_PAGE_PASSWORD;

  if (!appPassword || !adminPassword || !angelPassword) {
    throw new Error("APP_PASSWORD, ADMIN_PAGE_PASSWORD, ANGEL_PAGE_PASSWORD 환경변수가 필요합니다.");
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const { domain, secure } = cookieDomain(baseUrl);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
  });

  await context.addCookies([
    {
      name: "meetup_auth",
      value: authToken(appPassword),
      domain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure,
    }
  ]);

  const page = await context.newPage();
  const results = [];

  for (const route of ROUTES) {
    if (route.role) {
      const password = route.role === "admin" ? adminPassword : angelPassword;
      await context.addCookies([
        {
          name: "meetup_role_access",
          value: `${route.role}.${roleToken(route.role, password)}`,
          domain,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          secure,
        },
      ]);
    }
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
