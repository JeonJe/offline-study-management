import { defineConfig } from "@playwright/test";
import path from "node:path";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    storageState: path.join(__dirname, "e2e/.auth/state.json"),
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
      // 회귀 시나리오는 별도 `regression` 프로젝트에서만 실행 — chromium에서 중복 실행되면
      // 같은 TEST_DATE/TEST_LABEL로 데이터가 두 번 만들어져 회귀 안전망이 무너진다
      testIgnore: "**/regression-*.spec.ts",
    },
    // regression 시나리오 전용 프로젝트 — 네트워크 flakiness 대비 retries: 1
    {
      name: "regression",
      use: { browserName: "chromium" },
      testMatch: "**/regression-*.spec.ts",
      retries: 1,
    },
  ],
});
