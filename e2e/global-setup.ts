import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { AUTH_STATE, BASE_URL, CACHE_TEST_DATE } from "./support/test-config";

export default async function globalSetup() {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error("APP_PASSWORD 환경변수가 설정되지 않았습니다.");
  }

  fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/?date=${CACHE_TEST_DATE}`);

  await page.getByLabel("입장 코드").fill(password);
  await page.locator('form:has(input[name="authScope"][value="unit"]) button.login-submit').click();

  // 대시보드 로드 대기 (로그인 성공)
  await page.waitForURL(/\/cohorts\/[^/]+\/loop-pak/, { timeout: 15_000 });
  await page.waitForSelector("text=모임 수", { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_STATE });
  await browser.close();
}
