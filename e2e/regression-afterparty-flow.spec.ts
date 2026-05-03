import { test, expect, chromium } from "@playwright/test";
import {
  AUTH_STATE,
  BASE_URL,
  REGRESSION_TEST_DATE,
  cohortPath,
  waitForCohortDateUrl,
} from "./support/test-config";

// cache/performance spec과 날짜 충돌 방지
const AFTERPARTY_PAGE = cohortPath("afterparty", { date: REGRESSION_TEST_DATE });

// 회귀 테스트 전용 라벨 prefix — 다른 spec의 E2E 데이터와 구분
const TEST_LABEL = "R회귀뒷풀이";
// 참여자 이름 — 정산 토글 검증용
const TEST_PARTICIPANT = "R회귀참석자";

// ---------- helpers ----------

/** 뒷풀이 상세 페이지에서 삭제 수행 (cache-consistency.spec.ts 패턴 차용) */
async function deleteAfterpartyFromDetail(
  page: import("@playwright/test").Page,
) {
  page.once("dialog", (d) => d.accept());
  await page.locator('button:has-text("수정 관리")').click();
  await page.locator('[role="dialog"]').waitFor();
  await page
    .locator('[role="dialog"] button:has-text("이 뒷풀이 삭제")')
    .click();
  await page.waitForURL(waitForCohortDateUrl("afterparty"), {
    timeout: 10_000,
  });
}

/**
 * 뒷풀이 목록에서 TEST_LABEL로 시작하는 테스트 데이터를 모두 삭제
 * beforeAll에서 이전 실행 잔여 데이터 cleanup에 사용
 */
async function cleanupByLabel(
  page: import("@playwright/test").Page,
  label: string,
  listUrl: string,
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.goto(listUrl, { waitUntil: "domcontentloaded" });
    const link = page.locator(`a[aria-label*="${label}"]`).first();
    if ((await link.count()) === 0) break;

    await link.click();
    await page.waitForLoadState("domcontentloaded");

    // 삭제 실패는 silent break 금지 — 오염된 테스트 데이터를 그대로 둔 채
    // 본 시나리오를 진행하면 false positive 회귀 통과를 만든다 (fail-fast)
    await deleteAfterpartyFromDetail(page);
  }
}

/** 정산 카운트 텍스트(정산 N/M)에서 정산 완료 수 파싱 */
async function getSettledCount(
  page: import("@playwright/test").Page,
): Promise<number> {
  const badge = page.locator("span:has-text(\"정산 \")").filter({
    hasText: /정산 \d+\/\d+/,
  }).first();
  await expect(badge).toBeVisible();
  const text = (await badge.textContent()) ?? "";
  const match = text.match(/정산\s*(\d+)\/\d+/);
  if (!match) throw new Error(`정산 카운트 파싱 실패: ${text}`);
  return Number(match[1]);
}

// ---------- 회귀 테스트: 뒷풀이 흐름 ----------

test.describe.serial("회귀: 뒷풀이 생성 → 참여 → 정산 → 삭제", () => {
  let afterpartyDetailUrl = "";

  // 이전 실행에서 남은 테스트 데이터 정리
  test.beforeAll(async () => {
    const browser = await chromium.launch();
    // 수동 context는 config.use.baseURL을 상속받지 않으므로 명시적으로 전달
    // (page.goto의 상대 경로가 정상 해석되어야 cleanup이 실제로 동작)
    const context = await browser.newContext({
      storageState: AUTH_STATE,
      baseURL: BASE_URL,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);

    await cleanupByLabel(page, TEST_LABEL, AFTERPARTY_PAGE);

    await context.close();
    await browser.close();
  });

  // ---- R6: 뒷풀이 생성 → 목록 반영 ----
  test("R6: 뒷풀이 생성 → 목록 반영", async ({ page }) => {
    await page.goto(AFTERPARTY_PAGE);

    // FAB 열기
    const fab = page.locator("details:has(summary.fab-pulse)");
    await fab.locator("summary").click();

    // 폼 작성
    await fab.locator('input[name="title"]').fill(`${TEST_LABEL}A`);
    await fab.locator('input[name="location"]').fill("회귀뒷풀이장소");

    // 생성 제출
    await fab.locator('button[type="submit"]:has-text("생성")').click();

    // 뒷풀이 목록 리다이렉트 대기
    await page.waitForURL(waitForCohortDateUrl("afterparty"));

    // 생성된 뒷풀이 카드 노출 확인
    await expect(
      page.locator(`article:has-text("${TEST_LABEL}A")`).first(),
    ).toBeVisible();

    // 상세 URL 저장
    const link = page
      .locator(`a[aria-label="${TEST_LABEL}A 상세 보기"]`)
      .first();
    afterpartyDetailUrl = (await link.getAttribute("href")) ?? "";
    expect(afterpartyDetailUrl).toContain("/afterparty/");
  });

  // ---- R7: 참여자 추가 → 정산 섹션 확인 ----
  test("R7: 참여자 추가 → 참석자 목록 + 정산 섹션 확인", async ({ page }) => {
    test.skip(!afterpartyDetailUrl, "R6 실패로 건너뜀");

    await page.goto(afterpartyDetailUrl);

    // 참여자 이름 입력 → 추가
    const participantForm = page
      .locator("section")
      .filter({ hasText: "참여자 관리" })
      .locator('form:has(input[name="names"])')
      .first();
    await participantForm
      .locator('input[name="names"]')
      .fill(TEST_PARTICIPANT);
    await participantForm
      .locator('button[type="submit"]:has-text("추가")')
      .click();
    await page.waitForLoadState("domcontentloaded");

    // 참석자 목록에 이름 노출 확인
    await expect(
      page.getByText(TEST_PARTICIPANT, { exact: false }).first(),
    ).toBeVisible();

    // 정산 섹션 노출 확인
    await expect(page.getByText("정산 선택")).toBeVisible();

    // 정산 카운트(정산 N/M) 노출 확인
    await expect(
      page.locator("span").filter({ hasText: /정산 \d+\/\d+/ }).first(),
    ).toBeVisible();
  });

  // ---- R8: 정산 토글 → 카운트 갱신 ----
  test("R8: 정산 토글 → 카운트 갱신", async ({ page }) => {
    test.skip(!afterpartyDetailUrl, "R6 실패로 건너뜀");

    await page.goto(afterpartyDetailUrl);

    // 정산 완료 수 초기값 기록
    const beforeCount = await getSettledCount(page);

    // 미정산 상태 <label> 클릭 → 정산 완료로 토글
    // SettlementToggle: <label> 안에 숨겨진 checkbox + "미정산"/"정산 완료" span
    const unsettledLabel = page
      .locator("label")
      .filter({ hasText: "미정산" })
      .first();
    await expect(unsettledLabel).toBeVisible();
    await unsettledLabel.click();

    // 정산 카운트 +1 확인
    await expect
      .poll(async () => getSettledCount(page), { timeout: 10_000 })
      .toBe(beforeCount + 1);

    // 다시 <label> 클릭 → 미완료로 토글 (정산 완료 → 미정산)
    const settledLabel = page
      .locator("label")
      .filter({ hasText: "정산 완료" })
      .first();
    await expect(settledLabel).toBeVisible();
    await settledLabel.click();

    // 정산 카운트 원복 확인
    await expect
      .poll(async () => getSettledCount(page), { timeout: 10_000 })
      .toBe(beforeCount);
  });

  // ---- R9: 뒷풀이 삭제 → 목록 제거 ----
  test("R9: 뒷풀이 삭제 → 목록에서 제거", async ({ page }) => {
    test.skip(!afterpartyDetailUrl, "R6 실패로 건너뜀");

    await page.goto(afterpartyDetailUrl);
    await deleteAfterpartyFromDetail(page);

    // 목록에서 해당 뒷풀이 카드 사라짐 확인
    await page.goto(AFTERPARTY_PAGE);
    await expect(
      page.locator(`a[aria-label="${TEST_LABEL}A 상세 보기"]`),
    ).toHaveCount(0);
  });
});
