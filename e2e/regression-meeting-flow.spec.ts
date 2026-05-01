import { test, expect, chromium } from "@playwright/test";
import path from "node:path";

// 기존 spec(cache-consistency, performance)은 2026-03-01 사용 → 날짜 충돌 방지
const TEST_DATE = "2026-09-01";
const DASHBOARD = `/?date=${TEST_DATE}`;
const AUTH_STATE = path.join(__dirname, ".auth", "state.json");

// 회귀 테스트 전용 라벨 prefix — 다른 spec의 E2E 데이터와 구분
const TEST_LABEL = "R회귀모임";

// ---------- helpers ----------

/** 모임 상세 페이지에서 삭제 수행 (cache-consistency.spec.ts 패턴 차용) */
async function deleteMeetingFromDetail(page: import("@playwright/test").Page) {
  page.once("dialog", (d) => d.accept());
  await page.locator('button:has-text("수정 관리")').click();
  await page.locator('[role="dialog"]').waitFor();
  await page
    .locator('[role="dialog"] button:has-text("이 모임 삭제")')
    .click();
  await page.waitForURL(`**/?date=${TEST_DATE}**`, { timeout: 10_000 });
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

    try {
      await deleteMeetingFromDetail(page);
    } catch {
      break; // 삭제 실패 시 루프 종료
    }
  }
}

/** 모임 상세 페이지에서 총 참여자 수 파싱 */
async function getMeetingParticipantCount(
  page: import("@playwright/test").Page,
): Promise<number> {
  const summary = page.getByText(/총 \d+명 · 멤버 \d+명 · 운영진 \d+명/).first();
  await expect(summary).toBeVisible();
  const text = (await summary.textContent()) ?? "";
  const match = text.match(/총\s*(\d+)명/);
  if (!match) throw new Error(`참여자 수 파싱 실패: ${text}`);
  return Number(match[1]);
}

// ---------- 회귀 테스트: 모임 흐름 ----------

test.describe.serial("회귀: 모임 생성 → 참석 → 취소 → 재등록", () => {
  let meetingDetailUrl = "";

  // 이전 실행에서 남은 테스트 데이터 정리
  test.beforeAll(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ storageState: AUTH_STATE });
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
    await page.waitForURL(`**/?date=${TEST_DATE}**`);

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

    // 참여자 수 1명 증가 확인
    await expect
      .poll(async () => getMeetingParticipantCount(page), {
        timeout: 10_000,
      })
      .toBe(beforeCount + 1);
    const afterCount = await getMeetingParticipantCount(page);
    expect(afterCount).toBe(beforeCount + 1);

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

    // 참여자 수 -1 확인
    await expect
      .poll(async () => getMeetingParticipantCount(page), {
        timeout: 10_000,
      })
      .toBe(beforeCount - 1);
    const afterRemoveCount = await getMeetingParticipantCount(page);
    expect(afterRemoveCount).toBe(beforeCount - 1);

    // 동일 멤버 재등록 — 이전에 제거된 슬롯이 다시 미할당 상태가 됨
    const assignSection = page.locator("#team-assignment");
    const firstUnassignedForm = assignSection
      .locator("form:has(input[name=\"names\"])")
      .filter({ hasNot: page.locator("button:has-text(\"추가됨\")") })
      .first();
    await expect(firstUnassignedForm).toBeVisible();
    await firstUnassignedForm.locator("button[type=\"submit\"]").first().click();

    // 참여자 수 원복 확인
    await expect
      .poll(async () => getMeetingParticipantCount(page), {
        timeout: 10_000,
      })
      .toBe(beforeCount);
    const afterReaddCount = await getMeetingParticipantCount(page);
    expect(afterReaddCount).toBe(beforeCount);

    // 대시보드 카드 총참여 수 정합성 확인
    await page.goto(DASHBOARD);
    const card = page.locator(`article:has-text("${TEST_LABEL}A")`).first();
    await expect(card.getByText(`총참여 ${afterReaddCount}`)).toBeVisible();
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
