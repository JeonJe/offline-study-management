import { test, expect, chromium, type Page } from "@playwright/test";
import {
  AUTH_STATE,
  CACHE_TEST_DATE,
  cohortPath,
  waitForCohortDateUrl,
} from "./support/test-config";
import { submitServerActionAndFollowRedirect } from "./support/server-action";

const DASHBOARD = cohortPath("study", { date: CACHE_TEST_DATE });
const AFTERPARTY_PAGE = cohortPath("afterparty", { date: CACHE_TEST_DATE });
const MEMBERS_PAGE = cohortPath("members");

// ---------- helpers ----------

async function openManagementDialog(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  const manageButton = page.getByRole("button", { name: "수정 관리" });
  await expect(manageButton).toBeVisible({ timeout: 10_000 });
  const managementDialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: "수정 관리" })
    .first();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await manageButton.click();
    try {
      await expect(managementDialog).toBeVisible({ timeout: 1_500 });
      return managementDialog;
    } catch {
      await page.waitForTimeout(250);
    }
  }

  await expect(managementDialog).toBeVisible({ timeout: 10_000 });
  return managementDialog;
}

/** 모임 상세 페이지에서 삭제 수행 */
async function deleteMeetingFromDetail(page: Page) {
  const managementDialog = await openManagementDialog(page);
  await managementDialog.getByRole("button", { name: "이 모임 삭제" }).click();
  const confirmDialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: "삭제할까요?" })
    .last();
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await confirmDialog.getByRole("button", { name: "확인" }).click();
  await page.waitForURL(waitForCohortDateUrl("study"), { timeout: 10_000 });
}

/** 뒤풀이 상세 페이지에서 삭제 수행 */
async function deleteAfterpartyFromDetail(page: Page) {
  const managementDialog = await openManagementDialog(page);
  await managementDialog.getByRole("button", { name: "뒷풀이 삭제" }).click();
  const confirmDialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: "삭제할까요?" })
    .last();
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await confirmDialog.getByRole("button", { name: "확인" }).click();
  await page.waitForURL(waitForCohortDateUrl("afterparty"), {
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
  const summary = page
    .locator("dt", { hasText: /^(전체 확정|확정|총원)$/ })
    .first()
    .locator("xpath=following-sibling::dd[1]");
  await expect(summary).toBeVisible();
  const text = (await summary.textContent()) ?? "";
  const match = text.match(/(\d+)명/);
  if (!match) throw new Error(`참여자 수 파싱 실패: ${text}`);
  return Number(match[1]);
}

function normalizeVisibleText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// ---------- 테스트 ----------

test.describe.serial("캐시 정합성", () => {
  let meetingDetailUrl = "";
  let afterpartyDetailUrl = "";
  let leadersSupported = false;

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
    const leadersInput = fab.locator('input[data-leader-input="true"]');
    leadersSupported = (await leadersInput.count()) > 0;
    if (leadersSupported) {
      await leadersInput.fill("이순신, 유관순");
      await fab.locator('button[type="button"]:has-text("추가")').click();
    }

    await submitServerActionAndFollowRedirect(page, () =>
      fab.getByRole("button", { name: "생성", exact: true }).click(),
    );

    // 생성된 모임 확인
    await expect(
      page.locator('article:has-text("E2E테스트모임")').first(),
    ).toBeVisible({ timeout: 20_000 });
    if (leadersSupported) {
      const card = page.locator('article:has-text("E2E테스트모임")').first();
      await expect(card.getByText("방장:")).toBeVisible();
      await expect(card.getByText("이순신")).toBeVisible();
      await expect(card.getByText("유관순")).toBeVisible();
    }

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
    if (leadersSupported) {
      await expect(page.getByText("방장:")).toBeVisible();
      await expect(page.getByText("이순신")).toBeVisible();
      await expect(page.getByText("유관순")).toBeVisible();
    }

    // 현재 참여자 수 기록
    const beforeCount = await getMeetingParticipantCount(page);

    // 퀵 어사인 섹션에서 미할당 멤버를 추가
    const assignSection = page.locator("#team-assignment");
    const firstUnassignedForm = assignSection
      .locator('form:has(input[name="names"]):not(:has-text("할당됨"))')
      .first();
    await expect(firstUnassignedForm).toBeVisible();
    await submitServerActionAndFollowRedirect(page, () =>
      firstUnassignedForm.locator("button").first().click(),
    );

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
    await expect(card.getByText(`전체 확정 ${afterCount}`)).toBeVisible();
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

    await submitServerActionAndFollowRedirect(page, () =>
      fab.getByRole("button", { name: "생성", exact: true }).click(),
    );

    // 생성된 뒤풀이 확인
    await expect(
      page.locator('article:has-text("E2E테스트뒤풀이")').first(),
    ).toBeVisible({ timeout: 20_000 });

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
      'form:has(input[name="mutationSource"][value="manual-add"])',
    );
    await participantForm
      .locator('input[name="names"]')
      .fill("장영실");
    await submitServerActionAndFollowRedirect(page, () =>
      participantForm.locator('button[type="submit"]:has-text("추가")').click(),
    );

    // 참석자 표시 확인
    await expect(
      page.getByText("장영실", { exact: false }).first(),
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

    await expect(page.getByText("멤버 명단")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^운영진$/ })).toBeVisible();

    // 현재 페이지 텍스트 스냅샷 (주요 영역)
    const contentBefore = normalizeVisibleText(await page.locator("main").innerText());
    expect(contentBefore.length).toBeGreaterThan(0);
    const stableSnippets = ["멤버 명단", "운영진"];
    for (const snippet of stableSnippets) {
      expect(contentBefore).toContain(snippet);
    }
    expect(contentBefore).toMatch(/\d+팀\s*\/\s*\d+명/);

    // 새로고침
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // 동일 데이터 확인
    const contentAfter = normalizeVisibleText(await page.locator("main").innerText());
    for (const snippet of stableSnippets) {
      expect(contentAfter).toContain(snippet);
    }
    expect(contentAfter).toMatch(/\d+팀\s*\/\s*\d+명/);
  });

  // ---- 시나리오 7 ----
  test("시나리오 7: 크로스 페이지 정합성", async ({ page }) => {
    // 모임 생성
    await page.goto(DASHBOARD);
    const meetingFab = page.locator("details:has(summary.fab-pulse)");
    await meetingFab.locator("summary").click();
    await meetingFab.locator('input[name="title"]').fill("E2E크로스모임");
    await meetingFab.locator('input[name="location"]').fill("크로스장소");
    await meetingFab.locator('input[data-leader-input="true"]').fill("정약용");
    await meetingFab.locator('button[type="button"]:has-text("추가")').click();
    await submitServerActionAndFollowRedirect(page, () =>
      meetingFab.locator("form").evaluate((form) => {
        (form as HTMLFormElement).requestSubmit();
      }),
    );
    await expect(
      page.locator('a[aria-label="E2E크로스모임 상세 보기"]').first(),
    ).toBeVisible({ timeout: 10_000 });

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
    await submitServerActionAndFollowRedirect(page, () =>
      afterpartyFab.locator("form").evaluate((form) => {
        (form as HTMLFormElement).requestSubmit();
      }),
    );
    await expect(
      page.locator('a[aria-label="E2E크로스뒤풀이 상세 보기"]').first(),
    ).toBeVisible({ timeout: 10_000 });

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
      'form:has(input[name="mutationSource"][value="manual-add"])',
    );
    await apForm.locator('input[name="names"]').fill(memberName);
    await apForm
      .locator('button[type="submit"]:has-text("추가")')
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
