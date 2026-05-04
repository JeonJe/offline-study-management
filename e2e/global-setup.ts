import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  AUTH_STATE,
  BASE_URL,
  CACHE_TEST_DATE,
  TEST_OPERATING_UNIT_SLUG,
} from "./support/test-config";
import { submitServerActionAndFollowRedirect } from "./support/server-action";

export default async function globalSetup() {
  const password =
    process.env.E2E_OPERATING_UNIT_PASSWORD ?? process.env.APP_PASSWORD;
  if (!password) {
    throw new Error("E2E_OPERATING_UNIT_PASSWORD 또는 APP_PASSWORD 환경변수가 설정되지 않았습니다.");
  }

  fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const returnPath = `/cohorts/${TEST_OPERATING_UNIT_SLUG}/loop-pak?date=${CACHE_TEST_DATE}`;
  await page.goto(
    `${BASE_URL}/cohorts/${TEST_OPERATING_UNIT_SLUG}/entry?returnPath=${encodeURIComponent(returnPath)}`
  );

  await page.getByLabel("입장 코드").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === `/cohorts/${TEST_OPERATING_UNIT_SLUG}/loop-pak`, {
      timeout: 15_000,
    }),
    page.locator('form:has(input[name="authScope"][value="unit"]) button.login-submit').click(),
  ]);

  // 대시보드 로드 대기 (로그인 성공)
  await page.waitForSelector("text=모임 수", { timeout: 15_000 });

  const adminPassword = process.env.E2E_ADMIN_PASSWORD?.trim();
  if (adminPassword) {
    const adminPath = `/cohorts/${TEST_OPERATING_UNIT_SLUG}/admin`;
    await page.goto(`${BASE_URL}${adminPath}`);
    await page.getByLabel("비밀번호").fill(adminPassword);
    await submitServerActionAndFollowRedirect(page, () =>
      page.getByRole("button", { name: "열기" }).click(),
    );
    await page.waitForSelector("text=멤버/팀/엔젤 배정", { timeout: 15_000 });
  }

  await page.context().storageState({ path: AUTH_STATE });
  await browser.close();
}
