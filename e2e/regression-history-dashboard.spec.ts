import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  DEFAULT_HISTORY_END_DATE,
  DEFAULT_HISTORY_START_DATE,
  HISTORY_FILTER_END_DATE,
  HISTORY_FILTER_START_DATE,
  TEST_OPERATING_UNIT_SLUG,
  cohortPath,
} from "./support/test-config";

test.describe("회귀: 히스토리 대시보드", () => {
  test("기간 변경 시 팀/멤버 히스토리 표 URL과 화면이 갱신된다", async ({ page }) => {
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error("E2E_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.");
    }

    const token = createHash("sha256")
      .update(`saturday-meetup:operating-unit:${TEST_OPERATING_UNIT_SLUG}:admin:${adminPassword}`)
      .digest("hex");
    await page.context().addCookies([
      {
        name: "meetup_role_access",
        value: `admin.${encodeURIComponent(TEST_OPERATING_UNIT_SLUG)}.${token}`,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto(cohortPath("admin/history"));

    await expect(page.getByRole("heading", { level: 1, name: "참여 통계" })).toBeVisible();
    await expect(page.getByLabel("시작일")).toHaveValue(DEFAULT_HISTORY_START_DATE);
    await expect(page.getByLabel("종료일")).toHaveValue(DEFAULT_HISTORY_END_DATE);

    await page.getByLabel("시작일").fill(HISTORY_FILTER_START_DATE);
    await page.getByLabel("종료일").fill(HISTORY_FILTER_END_DATE);
    await page.getByRole("button", { name: "조회" }).click();

    await expect(page).toHaveURL(new RegExp(`start=${HISTORY_FILTER_START_DATE}`));
    await expect(page).toHaveURL(new RegExp(`end=${HISTORY_FILTER_END_DATE}`));
    await expect(page.getByText(`${HISTORY_FILTER_START_DATE} ~ ${HISTORY_FILTER_END_DATE}`)).toBeVisible();

    await page.getByRole("link", { name: "멤버별" }).click();

    await expect(page).toHaveURL(/tab=member/);
    await expect(page.getByRole("heading", { level: 3, name: "멤버별 참여" })).toBeVisible();
  });
});
