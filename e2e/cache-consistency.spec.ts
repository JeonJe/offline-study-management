import { test, expect, chromium } from "@playwright/test";
import path from "node:path";

const TEST_DATE = "2026-03-01";
const DASHBOARD = `/?date=${TEST_DATE}`;
const AFTERPARTY_PAGE = `/afterparty?date=${TEST_DATE}`;
const MEMBERS_PAGE = "/members";
const AUTH_STATE = path.join(__dirname, ".auth", "state.json");

// ---------- helpers ----------

/** 모임 상세 페이지에서 삭제 수행 */
async function deleteMeetingFromDetail(page: import("@playwright/test").Page) {
  page.once("dialog", (d) => d.accept());
  await page.locator('button:has-text("수정 관리")').click();
  await page.locator('[role="dialog"]').waitFor();
  await page
    .locator('[role="dialog"] button:has-text("이 모임 삭제")')
    .click();
  await page.waitForURL(`**/?date=${TEST_DATE}**`, { timeout: 10_000 });
}

/** 뒤풀이 상세 페이지에서 삭제 수행 */
async function deleteAfterpartyFromDetail(
  page: import("@playwright/test").Page,
) {
  await page.locator('button:has-text("수정 관리")').click();
  await page.locator('[role="dialog"]').waitFor();
  await page
    .locator('[role="dialog"] button:has-text("뒷풀이 삭제")')
    .click();
  await page.waitForURL(`**/afterparty?date=${TEST_DATE}**`, {
    timeout: 10_000,
  });
}

/** 대시보드/뒤풀이 목록에서 특정 라벨의 테스트 데이터를 모두 삭제 */
async function cleanupByLabel(
  page: import("@playwright/test").Page,
  label: string,
  listUrl: string,
  kind: "meeting" | "afterparty",
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.goto(listUrl, { waitUntil: "domcontentloaded" });
    const link = page.locator(`a[aria-label*="${label}"]`).first();
    if ((await link.count()) === 0) break;

    await link.click();
    await page.waitForLoadState("domcontentloaded");

    try {
      if (kind === "meeting") {
        await deleteMeetingFromDetail(page);
      } else {
        await deleteAfterpartyFromDetail(page);
      }
    } catch {
      break; // 삭제 실패 시 루프 종료
    }
  }
}

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

// ---------- 테스트 ----------

test.describe.serial("캐시 정합성", () => {
  let meetingDetailUrl = "";
  let afterpartyDetailUrl = "";

  // 이전 실행에서 남은 테스트 데이터 정리
  test.beforeAll(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);

    await cleanupByLabel(page, "E2E테스트", DASHBOARD, "meeting");
    await cleanupByLabel(page, "E2E크로스", DASHBOARD, "meeting");
    await cleanupByLabel(page, "E2E성능", DASHBOARD, "meeting");
    await cleanupByLabel(page, "E2E테스트", AFTERPARTY_PAGE, "afterparty");
    await cleanupByLabel(page, "E2E크로스", AFTERPARTY_PAGE, "afterparty");

    await context.close();
    await browser.close();
  });

  // ---- 시나리오 1 ----
  test("시나리오 1: 모임 생성 → 목록 즉시 반영", async ({ page }) => {
    await page.goto(DASHBOARD);

    // FAB 열기
    const fab = page.locator("details:has(summary.fab-pulse)");
    await fab.locator("summary").click();

    // 폼 작성
    await fab.locator('input[name="title"]').fill("E2E테스트모임");
    await fab.locator('input[name="location"]').fill("테스트장소");

    // 제출
    await fab.locator('button[type="submit"]:has-text("생성")').click();

    // 대시보드 리다이렉트 대기
    await page.waitForURL(`**/?date=${TEST_DATE}**`);

    // 생성된 모임 확인
    await expect(
      page.locator('article:has-text("E2E테스트모임")').first(),
    ).toBeVisible();

    // 상세 URL 저장
    const link = page
      .locator('a[aria-label="E2E테스트모임 상세 보기"]')
      .first();
    meetingDetailUrl = (await link.getAttribute("href")) ?? "";
    expect(meetingDetailUrl).toContain("/meetings/");
  });

  // ---- 시나리오 2 ----
  test("시나리오 2: 참석자 추가 → 즉시 반영", async ({ page }) => {
    test.skip(!meetingDetailUrl, "시나리오 1 실패로 건너뜀");

    await page.goto(meetingDetailUrl);

    // 현재 참여자 수 기록
    const beforeCount = await getMeetingParticipantCount(page);

    // 퀵 어사인 섹션에서 미할당 멤버를 추가
    const assignSection = page.locator("#team-assignment");
    const firstUnassignedForm = assignSection
      .locator('form:has(input[name="names"]):not(:has-text("할당됨"))')
      .first();
    await expect(firstUnassignedForm).toBeVisible();
    await firstUnassignedForm.locator("button").first().click();

    // 참여자 수 1명 증가 확인
    await expect
      .poll(async () => getMeetingParticipantCount(page), {
        timeout: 10_000,
      })
      .toBe(beforeCount + 1);
    const afterCount = await getMeetingParticipantCount(page);
    expect(afterCount).toBe(beforeCount + 1);

    // 대시보드에서 참석자 수 반영 확인
    await page.goto(DASHBOARD);
    const card = page.locator('article:has-text("E2E테스트모임")').first();
    await expect(card.getByText(`총참여 ${afterCount}`)).toBeVisible();
  });

  // ---- 시나리오 3 ----
  test("시나리오 3: 모임 삭제 → 목록에서 즉시 제거", async ({ page }) => {
    test.skip(!meetingDetailUrl, "시나리오 1 실패로 건너뜀");

    await page.goto(meetingDetailUrl);
    await deleteMeetingFromDetail(page);

    // 대시보드에서 사라졌는지 확인
    await page.goto(DASHBOARD);
    await expect(
      page.locator('a[aria-label="E2E테스트모임 상세 보기"]'),
    ).toHaveCount(0);
  });

  // ---- 시나리오 4 ----
  test("시나리오 4: 뒤풀이 생성 → 목록 즉시 반영", async ({ page }) => {
    await page.goto(AFTERPARTY_PAGE);

    // FAB 열기
    const fab = page.locator("details:has(summary.fab-pulse)");
    await fab.locator("summary").click();

    // 폼 작성
    await fab.locator('input[name="title"]').fill("E2E테스트뒤풀이");
    await fab.locator('input[name="location"]').fill("테스트장소");

    // 제출
    await fab.locator('button[type="submit"]:has-text("생성")').click();

    // 리다이렉트 대기
    await page.waitForURL(`**/afterparty?date=${TEST_DATE}**`);

    // 생성된 뒤풀이 확인
    await expect(
      page.locator('article:has-text("E2E테스트뒤풀이")').first(),
    ).toBeVisible();

    // 상세 URL 저장
    const link = page
      .locator('a[aria-label="E2E테스트뒤풀이 상세 보기"]')
      .first();
    afterpartyDetailUrl = (await link.getAttribute("href")) ?? "";
    expect(afterpartyDetailUrl).toContain("/afterparty/");
  });

  // ---- 시나리오 5 ----
  test("시나리오 5: 뒤풀이 참석자 + 정산 정합성", async ({ page }) => {
    test.skip(!afterpartyDetailUrl, "시나리오 4 실패로 건너뜀");

    await page.goto(afterpartyDetailUrl);

    // 참여자 추가 (텍스트 입력)
    const participantForm = page.locator(
      'form:has(input[name="names"][placeholder*="이름"])',
    );
    await participantForm
      .locator('input[name="names"]')
      .fill("E2E테스트참석자");
    await participantForm
      .locator('button[type="submit"]:has-text("참여자 추가")')
      .click();
    await page.waitForLoadState("domcontentloaded");

    // 참석자 표시 확인
    await expect(
      page.getByText("E2E테스트참석자", { exact: false }).first(),
    ).toBeVisible();

    // 정산 섹션 표시 확인
    await expect(page.getByText("정산 선택")).toBeVisible();
    await expect(
      page.getByText(/정산 \d+\/\d+/).first(),
    ).toBeVisible();

    // 뒤풀이 삭제
    await deleteAfterpartyFromDetail(page);

    // 목록에서 제거 확인
    await page.goto(AFTERPARTY_PAGE);
    await expect(
      page.locator('a[aria-label="E2E테스트뒤풀이 상세 보기"]'),
    ).toHaveCount(0);
  });

  // ---- 시나리오 6 ----
  test("시나리오 6: 멤버 프리셋 읽기 정합성", async ({ page }) => {
    await page.goto(MEMBERS_PAGE);
    await page.waitForLoadState("domcontentloaded");

    // 현재 페이지 텍스트 스냅샷 (주요 영역)
    const sections = page.locator("section.card-static");
    const contentBefore = await sections.allTextContents();
    expect(contentBefore.length).toBeGreaterThan(0);

    // 새로고침
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // 동일 데이터 확인
    const contentAfter = await sections.allTextContents();
    expect(contentAfter).toEqual(contentBefore);
  });

  // ---- 시나리오 7 ----
  test("시나리오 7: 크로스 페이지 정합성", async ({ page }) => {
    // 모임 생성
    await page.goto(DASHBOARD);
    const meetingFab = page.locator("details:has(summary.fab-pulse)");
    await meetingFab.locator("summary").click();
    await meetingFab.locator('input[name="title"]').fill("E2E크로스모임");
    await meetingFab.locator('input[name="location"]').fill("크로스장소");
    await meetingFab
      .locator('button[type="submit"]:has-text("생성")')
      .click();
    await page.waitForURL(`**/?date=${TEST_DATE}**`);

    const crossMeetingUrl =
      (await page
        .locator('a[aria-label="E2E크로스모임 상세 보기"]')
        .first()
        .getAttribute("href")) ?? "";

    // 뒤풀이 생성
    await page.goto(AFTERPARTY_PAGE);
    const afterpartyFab = page.locator("details:has(summary.fab-pulse)");
    await afterpartyFab.locator("summary").click();
    await afterpartyFab
      .locator('input[name="title"]')
      .fill("E2E크로스뒤풀이");
    await afterpartyFab.locator('input[name="location"]').fill("크로스장소");
    await afterpartyFab
      .locator('button[type="submit"]:has-text("생성")')
      .click();
    await page.waitForURL(`**/afterparty?date=${TEST_DATE}**`);

    const crossAfterpartyUrl =
      (await page
        .locator('a[aria-label="E2E크로스뒤풀이 상세 보기"]')
        .first()
        .getAttribute("href")) ?? "";

    // 모임 상세에서 퀵 어사인으로 멤버 추가
    await page.goto(crossMeetingUrl);
    const assignSection = page.locator("#team-assignment");
    const memberForm = assignSection
      .locator('form:has(input[name="names"])')
      .first();
    const memberName = await memberForm
      .locator('input[name="names"]')
      .inputValue();
    await memberForm.locator('button[type="submit"]').click();
    await page.waitForLoadState("domcontentloaded");

    // 같은 멤버를 뒤풀이에도 추가
    await page.goto(crossAfterpartyUrl);
    const apForm = page.locator(
      'form:has(input[name="names"][placeholder*="이름"])',
    );
    await apForm.locator('input[name="names"]').fill(memberName);
    await apForm
      .locator('button[type="submit"]:has-text("참여자 추가")')
      .click();
    await page.waitForLoadState("domcontentloaded");

    // 모임 상세/뒤풀이 상세에서 동일 멤버 노출 확인
    await page.goto(crossMeetingUrl);
    await expect(
      page.getByText(memberName, { exact: false }).first(),
    ).toBeVisible();

    await page.goto(crossAfterpartyUrl);
    await expect(
      page.getByText(memberName, { exact: false }).first(),
    ).toBeVisible();

    // 정리: 모임 삭제
    await page.goto(crossMeetingUrl);
    await deleteMeetingFromDetail(page);

    // 정리: 뒤풀이 삭제
    await page.goto(crossAfterpartyUrl);
    await deleteAfterpartyFromDetail(page);
  });
});
