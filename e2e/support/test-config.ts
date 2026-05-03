import path from "node:path";

export const TEST_OPERATING_UNIT_SLUG =
  process.env.E2E_OPERATING_UNIT_SLUG?.trim() || "loop-pak-3";

export const CACHE_TEST_DATE = "2026-03-01";
export const REGRESSION_TEST_DATE = "2026-09-01";
export const DEFAULT_HISTORY_START_DATE = "2026-04-01";
export const DEFAULT_HISTORY_END_DATE = "2026-06-30";
export const HISTORY_FILTER_START_DATE = "2026-03-01";
export const HISTORY_FILTER_END_DATE = "2026-03-31";

export const AUTH_STATE = path.join(__dirname, "..", ".auth", "state.json");
export const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

type CohortSection =
  | "loop-pak"
  | "study"
  | "afterparty"
  | "members"
  | "angel/reports"
  | "admin/reports"
  | "admin/history";

export function cohortPath(
  section: CohortSection,
  params: Record<string, string> = {}
): string {
  const query = new URLSearchParams(params).toString();
  const pathname = `/cohorts/${TEST_OPERATING_UNIT_SLUG}/${section}`;
  return query ? `${pathname}?${query}` : pathname;
}

export function waitForCohortDateUrl(section: "study" | "afterparty"): string {
  return `**/cohorts/${TEST_OPERATING_UNIT_SLUG}/${section}?date=**`;
}

export function isProductionLikeBaseUrl(value: string): boolean {
  return value.includes("offline-study-management.vercel.app") || value.includes("vercel.app");
}
