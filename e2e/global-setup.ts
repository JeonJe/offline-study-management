import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const AUTH_FILE = path.join(__dirname, ".auth", "state.json");

export default async function globalSetup() {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error("APP_PASSWORD 환경변수가 설정되지 않았습니다.");
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(
    "https://offline-study-management.vercel.app/?date=2026-03-01",
  );

  await page.locator('input[name="password"]').fill(password);
  await page.locator("button.login-submit").click();

  // 대시보드 로드 대기 (로그인 성공)
  await page.waitForURL(/\/\?date=\d{4}-\d{2}-\d{2}/, { timeout: 15_000 });
  await page.waitForSelector("text=참여 커버리지", { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
}
