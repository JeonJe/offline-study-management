import { test, expect, chromium } from "@playwright/test";
import {
  AUTH_STATE,
  BASE_URL,
  REGRESSION_TEST_DATE,
  cohortPath,
  waitForCohortDateUrl,
} from "./support/test-config";

// cache/performance spec과 날짜 충돌 방지
const DASHBOARD = cohortPath("study", { date: REGRESSION_TEST_DATE });

// 회귀 테스트 전용 라벨 prefix — 다른 spec의 E2E 데이터와 구분
const TEST_LABEL = "R회귀모임";

// ---------- helpers ----------

/** 모임 상세 페이지에서 삭제 수행 (cache-consistency.spec.ts 패턴 차용) */
async function deleteMeetingFromDetail(page: import("@playwright/test").Page) {
  page.once("dialog", (d) => d.accept());
  await openManageModal(page);
  await page
    .locator('[role="dialog"] button:has-text("이 모임 삭제")')
    .click();
  await page.waitForURL(waitForCohortDateUrl("study"), { timeout: 10_000 });
}

async function openManageModal(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "수정 관리" });
  await expect(button).toBeVisible();
  await expect(async () => {
    await button.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

/**
 * 대시보드에서 TEST_LABEL로 시작하는 테스트 데이터를 모두 삭제
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
    await deleteMeetingFromDetail(page);
  }
}

/** 모임 상세 페이지에서 총 참여자 수 파싱 */
async function getMeetingParticipantCount(
  page: import("@playwright/test").Page,
): Promise<number> {
  const totalTerm = page.locator("dt").filter({ hasText: /^총원$/ }).first();
  await expect(totalTerm).toBeVisible();
  const text = (await totalTerm.locator("xpath=following-sibling::dd[1]").textContent()) ?? "";
  const match = text.match(/(\d+)명/);
  if (!match) throw new Error(`참여자 수 파싱 실패: ${text}`);
  return Number(match[1]);
}

// ---------- 회귀 테스트: 모임 흐름 ----------

test.describe.serial("회귀: 모임 생성 → 참석 → 취소 → 재등록", () => {
  let meetingDetailUrl = "";

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

    await cleanupByLabel(page, TEST_LABEL, DASHBOARD);

    await context.close();
    await browser.close();
  });

  // ---- R1: 모임 생성 → 대시보드 반영 ----
  test("R1: 모임 생성 → 대시보드 반영", async ({ page }) => {
    await page.goto(DASHBOARD);

    // FAB 열기
    const fab = page.locator("details:has(summary.fab-pulse)");
    await fab.locator("summary").click();

    // 폼 작성
    await fab.locator('input[name="title"]').fill(`${TEST_LABEL}A`);
    await fab.locator('input[name="location"]').fill("회귀테스트장소");

    // 생성 제출
    await fab.locator('button[type="submit"]:has-text("생성")').click();

    // 대시보드 리다이렉트 대기
    await page.waitForURL(waitForCohortDateUrl("study"));

    // 생성된 모임 카드 노출 확인
    await expect(
      page.locator(`article:has-text("${TEST_LABEL}A")`).first(),
    ).toBeVisible();

    // 상세 페이지 URL 저장
    const link = page
      .locator(`a[aria-label="${TEST_LABEL}A 상세 보기"]`)
      .first();
    meetingDetailUrl = (await link.getAttribute("href")) ?? "";
    expect(meetingDetailUrl).toContain("/meetings/");
  });

  // ---- R2: 참석 등록 ----
  test("R2: 참석 등록 → 참여자 수 반영", async ({ page }) => {
    test.skip(!meetingDetailUrl, "R1 실패로 건너뜀");

    await page.goto(meetingDetailUrl);

    // 현재 참여자 수 기록
    const beforeCount = await getMeetingParticipantCount(page);

    // 퀵 어사인 섹션에서 미할당 멤버 1명 추가
    // isAssigned=false인 버튼을 찾아 클릭 (추가됨 텍스트가 없는 첫 번째)
    const assignSection = page.locator("#team-assignment");
    const firstUnassignedForm = assignSection
      .locator("form:has(input[name=\"names\"])")
      .filter({ hasNot: page.locator("button:has-text(\"추가됨\")") })
      .first();
    await expect(firstUnassignedForm).toBeVisible();
    await firstUnassignedForm.locator("button[type=\"submit\"]").first().click();

    // 참여자 수 1명 증가 확인 — expect.poll이 통과하면 이미 증명됨, 중복 단언 제거
    await expect
      .poll(async () => getMeetingParticipantCount(page), {
        timeout: 10_000,
      })
      .toBe(beforeCount + 1);
    const afterCount = beforeCount + 1;

    // 대시보드 카드에서 총참여 수 반영 확인
    await page.goto(DASHBOARD);
    const card = page.locator(`article:has-text("${TEST_LABEL}A")`).first();
    await expect(card.getByText(`총참여 ${afterCount}`)).toBeVisible();
  });

  // ---- R3: 참석 취소 → 재등록 ----
  test("R3: 참석 취소 → 재등록 → 정합성 확인", async ({ page }) => {
    test.skip(!meetingDetailUrl, "R1 실패로 건너뜀");

    await page.goto(meetingDetailUrl);

    const beforeCount = await getMeetingParticipantCount(page);

    // 참여자 제거 — dialog를 먼저 등록한 뒤 × 버튼 클릭
    page.once("dialog", (d) => d.accept());
    await page.locator('button[aria-label="참여자 제거"]').first().click();

    // 참여자 수 -1 확인 — expect.poll이 통과하면 증명됨, 중복 단언 제거
    await expect
      .poll(async () => getMeetingParticipantCount(page), {
        timeout: 10_000,
      })
      .toBe(beforeCount - 1);

    // 동일 멤버 재등록 — 이전에 제거된 슬롯이 다시 미할당 상태가 됨
    const assignSection = page.locator("#team-assignment");
    const firstUnassignedForm = assignSection
      .locator("form:has(input[name=\"names\"])")
      .filter({ hasNot: page.locator("button:has-text(\"추가됨\")") })
      .first();
    await expect(firstUnassignedForm).toBeVisible();
    await firstUnassignedForm.locator("button[type=\"submit\"]").first().click();

    // 참여자 수 원복 확인 — expect.poll이 통과하면 증명됨, 중복 단언 제거
    await expect
      .poll(async () => getMeetingParticipantCount(page), {
        timeout: 10_000,
      })
      .toBe(beforeCount);

    // 대시보드 카드 총참여 수 정합성 확인
    await page.goto(DASHBOARD);
    const card = page.locator(`article:has-text("${TEST_LABEL}A")`).first();
    await expect(card.getByText(`총참여 ${beforeCount}`)).toBeVisible();
  });

  // ---- R4: 모임 삭제 → 목록 제거 ----
  test("R4: 모임 삭제 → 대시보드에서 제거", async ({ page }) => {
    test.skip(!meetingDetailUrl, "R1 실패로 건너뜀");

    await page.goto(meetingDetailUrl);
    await deleteMeetingFromDetail(page);

    // 대시보드에서 해당 모임 카드 사라짐 확인
    await page.goto(DASHBOARD);
    await expect(
      page.locator(`a[aria-label="${TEST_LABEL}A 상세 보기"]`),
    ).toHaveCount(0);
  });
});

test.describe.serial("회귀: 정원 초과 대기 → 승격", () => {
  const WAITLIST_LABEL = `${TEST_LABEL}대기`;
  let meetingDetailUrl = "";

  test.beforeAll(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      storageState: AUTH_STATE,
      baseURL: BASE_URL,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);

    await cleanupByLabel(page, WAITLIST_LABEL, DASHBOARD);

    await context.close();
    await browser.close();
  });

  test("R5: 대기 등록 → 승격 → 확정 표시", async ({ page }) => {
    await page.goto(DASHBOARD);

    const fab = page.locator("details:has(summary.fab-pulse)");
    await fab.locator("summary").click();
    await fab.locator('input[name="title"]').fill(WAITLIST_LABEL);
    await fab.locator('input[name="location"]').fill("회귀테스트장소");
    await fab.locator("form").evaluate((form) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "capacity";
      input.value = "1";
      form.appendChild(input);
    });
    await fab.locator('button[type="submit"]:has-text("생성")').click();
    await page.waitForURL(waitForCohortDateUrl("study"));

    const link = page
      .locator(`a[aria-label="${WAITLIST_LABEL} 상세 보기"]`)
      .first();
    meetingDetailUrl = (await link.getAttribute("href")) ?? "";
    expect(meetingDetailUrl).toContain("/meetings/");
    await page.goto(meetingDetailUrl);
    await expect(page.getByText("확정 0/1 · 대기 0")).toBeVisible();

    const manualAdd = page.locator('form:has(input[name="mutationSource"][value="manual-add"])');
    await manualAdd.locator('input[name="names"]').fill("이황, 이이");
    await manualAdd.locator('button[type="submit"]:has-text("추가")').click();
    await expect(page.getByText("확정 1/1 · 대기 1")).toBeVisible();
    await expect(page.getByText("이이")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.locator('button[aria-label="참여자 제거"]').first().click();
    await expect(page.getByText("확정 0/1 · 대기 1")).toBeVisible();

    await page.locator('li:has-text("이이") button:has-text("승격")').click();
    await expect(page.getByText("확정 1/1 · 대기 0")).toBeVisible();
    await expect(page.locator("section").filter({ hasText: "대기 인원" }).getByText("대기 중인 인원이 없습니다.")).toBeVisible();

    await deleteMeetingFromDetail(page);
    await page.goto(DASHBOARD);
    await expect(
      page.locator(`a[aria-label="${WAITLIST_LABEL} 상세 보기"]`),
    ).toHaveCount(0);
  });
});
