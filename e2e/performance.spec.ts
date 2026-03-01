import { test, expect, chromium } from "@playwright/test";
import path from "node:path";

const TEST_DATE = "2026-03-01";
const AUTH_STATE = path.join(__dirname, ".auth", "state.json");

const PAGES = [
  { name: "대시보드", url: `/?date=${TEST_DATE}` },
  { name: "뒤풀이", url: `/afterparty?date=${TEST_DATE}` },
  { name: "멤버", url: "/members" },
] as const;

const VISITS_PER_PAGE = 3;

async function measureTTFB(
  page: import("@playwright/test").Page,
): Promise<number> {
  return page.evaluate(() => {
    const [entry] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    return entry.responseStart - entry.fetchStart;
  });
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

        await page.goto(url, { waitUntil: "load" });
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
    // 1. 캐시 워밍
    await page.goto(`/?date=${TEST_DATE}`, { waitUntil: "load" });

    // 2. 모임 생성 (캐시 무효화 트리거)
    const fab = page.locator("details:has(summary.fab-pulse)");
    await fab.locator("summary").click();
    await fab.locator('input[name="title"]').fill("E2E성능테스트모임");
    await fab.locator('input[name="location"]').fill("성능테스트장소");

    const startTime = Date.now();
    await fab.locator('button[type="submit"]:has-text("생성")').click();

    // 3. 리다이렉트 후 페이지 로드 완료까지 측정
    await page.waitForURL(`**/?date=${TEST_DATE}**`);
    await page.waitForLoadState("domcontentloaded");
    const elapsed = Date.now() - startTime;

    console.log(`[뮤테이션 후 로드] ${elapsed}ms`);

    // 4. 1500ms 이내
    expect(elapsed).toBeLessThan(1500);

    // 5. 생성한 모임 확인 후 삭제
    await expect(
      page.locator('article:has-text("E2E성능테스트모임")').first(),
    ).toBeVisible();

    const link = page
      .locator('a[aria-label="E2E성능테스트모임 상세 보기"]')
      .first();
    const detailUrl = await link.getAttribute("href");
    if (detailUrl) {
      await page.goto(detailUrl);
      page.once("dialog", (d) => d.accept());
      await page.locator('button:has-text("수정 관리")').click();
      await page.locator('[role="dialog"]').waitFor();
      await page
        .locator('[role="dialog"] button:has-text("이 모임 삭제")')
        .click();
      await page.waitForURL(`**/?date=${TEST_DATE}**`);
    }
  });

  // 이전 실행 잔여 데이터 정리
  test.afterAll(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);

    for (let i = 0; i < 5; i++) {
      await page.goto(`/?date=${TEST_DATE}`, {
        waitUntil: "domcontentloaded",
      });
      const link = page
        .locator('a[aria-label*="E2E성능"]')
        .first();
      if ((await link.count()) === 0) break;

      await link.click();
      await page.waitForLoadState("domcontentloaded");
      try {
        page.once("dialog", (d) => d.accept());
        await page.locator('button:has-text("수정 관리")').click();
        await page.locator('[role="dialog"]').waitFor();
        await page
          .locator('[role="dialog"] button:has-text("이 모임 삭제")')
          .click();
        await page.waitForURL("**/*", { timeout: 10_000 });
      } catch {
        break;
      }
    }

    await context.close();
    await browser.close();
  });
});
