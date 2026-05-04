import type { Page } from "@playwright/test";

function actionRedirectPath(headerValue: string | undefined): string | null {
  const path = headerValue?.split(";")[0]?.trim();
  return path?.startsWith("/") ? path : null;
}

export async function submitServerActionAndFollowRedirect(
  page: Page,
  submit: () => Promise<unknown>,
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST",
    { timeout: 20_000 },
  );

  await submit();
  const response = await responsePromise;
  const redirectPath = actionRedirectPath(response.headers()["x-action-redirect"]);

  if (redirectPath) {
    const targetUrl = new URL(redirectPath, page.url());
    const currentUrl = new URL(page.url());
    if (
      targetUrl.origin === currentUrl.origin &&
      targetUrl.pathname === currentUrl.pathname &&
      targetUrl.search === currentUrl.search
    ) {
      await page.reload({ waitUntil: "domcontentloaded" });
      if (targetUrl.hash) {
        await page.evaluate((hash) => {
          window.location.hash = hash;
        }, targetUrl.hash);
      }
      return;
    }

    await page.goto(targetUrl.toString(), { waitUntil: "domcontentloaded" });
    return;
  }

  await page.reload({ waitUntil: "domcontentloaded" });
}
