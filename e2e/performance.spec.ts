import { test, expect, chromium } from "@playwright/test";
import {
  AUTH_STATE,
  CACHE_TEST_DATE,
  cohortPath,
} from "./support/test-config";
import { submitServerActionAndFollowRedirect } from "./support/server-action";

const PAGES = [
  { name: "대시보드", url: cohortPath("study", { date: CACHE_TEST_DATE }) },
  { name: "뒤풀이", url: cohortPath("afterparty", { date: CACHE_TEST_DATE }) },
  { name: "멤버", url: cohortPath("members") },
  { name: "엔젤 보고", url: cohortPath("angel/reports") },
  { name: "관리자 보고", url: cohortPath("admin/reports") },
] as const;

const VISITS_PER_PAGE = 3;

async function measureTTFB(
  page: import("@playwright/test").Page,
): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(() => {
        const [entry] = performance.getEntriesByType(
          "navigation",
        ) as PerformanceNavigationTiming[];
        return entry.responseStart - entry.fetchStart;
      });
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
  }

  throw new Error("TTFB 측정 실패");
}

// ---------- 시나리오 8: 페이지별 TTFB 측정 ----------

test.describe("페이지 성능", () => {
  for (const { name, url } of PAGES) {
    test(`시나리오 8: ${name} TTFB (cold vs warm)`, async ({ browser }) => {
      const ttfbs: number[] = [];

      for (let i = 0; i < VISITS_PER_PAGE; i++) {
        // 매 방문마다 새 컨텍스트 → 브라우저 캐시 없이 측정
        const context = await browser.newContext({
          storageState: "e2e/.auth/state.json",
        });
        const page = await context.newPage();

        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("load").catch(() => {});
        const ttfb = await measureTTFB(page);
        ttfbs.push(ttfb);

        await context.close();
      }

      const [cold, ...warm] = ttfbs;
      const avgWarm = warm.reduce((a, b) => a + b, 0) / warm.length;

      // 결과 출력
      console.log(
        `[${name}] cold=${cold.toFixed(0)}ms, warm avg=${avgWarm.toFixed(0)}ms`,
      );
      console.log(
        `[${name}] 전체: ${ttfbs.map((t) => `${t.toFixed(0)}ms`).join(", ")}`,
      );

      // warm TTFB < 1000ms
      expect(avgWarm).toBeLessThan(1000);
    });
  }

  // ---------- 시나리오 9: 뮤테이션 후 응답 속도 ----------

  test("시나리오 9: 뮤테이션 후 응답 속도", async ({ page }) => {
    const title = `E2E성능테스트모임-${Date.now()}`;
    // 1. 캐시 워밍
    await page.goto(cohortPath("study", { date: CACHE_TEST_DATE }), {
      waitUntil: "load",
    });

    // 2. 모임 생성 (캐시 무효화 트리거)
    const fab = page.locator("details:has(summary.fab-pulse)");
    await fab.locator("summary").click();
    await fab.locator('input[name="title"]').fill(title);
    await fab.locator('input[name="location"]').fill("성능테스트장소");
    await fab.locator('input[name="meetingDate"]').fill(CACHE_TEST_DATE);
    await fab.locator('input[data-leader-input="true"]').fill("E2E성능방장");
    await fab.locator('button[type="button"]:has-text("추가")').click();

    const startTime = Date.now();
    await submitServerActionAndFollowRedirect(page, () =>
      fab.locator("form").evaluate((form) => {
        (form as HTMLFormElement).requestSubmit();
      }),
    );

    // 생성 결과가 실제 목록에 나타나는 시점을 뮤테이션 완료 기준으로 삼는다.
    await expect(
      page.locator(`a[aria-label="${title} 상세 보기"]`).first(),
    ).toBeVisible({ timeout: 20_000 });
    const elapsed = Date.now() - startTime;

    console.log(`[뮤테이션 후 로드] ${elapsed}ms`);

    // 4. 1500ms 이내
    expect(elapsed).toBeLessThan(1500);
  });

  // 이전 실행 잔여 데이터 정리
  test.afterAll(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);

    for (let i = 0; i < 5; i++) {
      await page.goto(cohortPath("study", { date: "" }), {
        waitUntil: "domcontentloaded",
      });
      const link = page
        .locator('a[aria-label*="E2E성능"]')
        .first();
      if ((await link.count()) === 0) break;

      await link.click();
      await page.waitForLoadState("domcontentloaded");
      try {
        const manageButton = page.getByRole("button", { name: "수정 관리" });
        await expect(manageButton).toBeVisible({ timeout: 10_000 });
        await manageButton.click();
        const managementDialog = page
          .locator('[role="dialog"]')
          .filter({ hasText: "수정 관리" })
          .first();
        await expect(managementDialog).toBeVisible({ timeout: 10_000 });
        await managementDialog.getByRole("button", { name: "이 모임 삭제" }).click();
        const confirmDialog = page
          .locator('[role="dialog"]')
          .filter({ hasText: "삭제할까요?" })
          .last();
        await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
        await confirmDialog.getByRole("button", { name: "확인" }).click();
        await page.waitForURL("**/*", { timeout: 10_000 });
      } catch {
        break;
      }
    }

    await context.close();
    await browser.close();
  });
});
