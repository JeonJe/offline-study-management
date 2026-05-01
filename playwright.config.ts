import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "https://offline-study-management.vercel.app",
    storageState: path.join(__dirname, "e2e/.auth/state.json"),
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
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
