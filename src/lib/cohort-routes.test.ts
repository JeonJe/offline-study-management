import { describe, expect, it } from "vitest";
import {
  cohortScopedPath,
  resolveCohortRewrite,
} from "@/lib/cohort-routes";

describe("cohort-routes", () => {
  it("cohortScopedPath는 기수 slug를 안전한 path segment로 인코딩한다", () => {
    expect(cohortScopedPath("3기", "angel")).toBe("/cohorts/3%EA%B8%B0/angel");
  });

  it("cohortScopedPath는 section 미전달 시 루프팩으로 진입시킨다", () => {
    expect(cohortScopedPath("3기")).toBe("/cohorts/3%EA%B8%B0/loop-pak");
  });

  it("resolveCohortRewrite는 cohort URL을 기존 route 대상으로 매핑한다", () => {
    expect(resolveCohortRewrite("/cohorts/3%EA%B8%B0/angel/reports")).toEqual({
      pathname: "/angel/reports",
      unitSlug: "3기",
    });
  });

  it("resolveCohortRewrite는 section이 없으면 루프팩으로 매핑한다", () => {
    expect(resolveCohortRewrite("/cohorts/3%EA%B8%B0")).toEqual({
      pathname: "/loop-pak",
      unitSlug: "3기",
    });
  });

  it("resolveCohortRewrite는 지원하지 않는 section을 거부한다", () => {
    expect(resolveCohortRewrite("/cohorts/3%EA%B8%B0/unknown")).toBeNull();
  });
});
