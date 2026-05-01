import { describe, expect, it } from "vitest";
import {
  cohortAwarePath,
  cohortScopedPath,
  resolveCohortRewrite,
} from "@/lib/cohort-routes";

describe("cohort-routes", () => {
  it("cohortScopedPath는 주소 식별자를 안전한 path segment로 인코딩한다", () => {
    expect(cohortScopedPath("loop-pak-3", "angel")).toBe("/cohorts/loop-pak-3/angel");
  });

  it("cohortScopedPath는 section 미전달 시 루프팩으로 진입시킨다", () => {
    expect(cohortScopedPath("loop-pak-3")).toBe("/cohorts/loop-pak-3/loop-pak");
  });

  it("resolveCohortRewrite는 cohort URL을 기존 route 대상으로 매핑한다", () => {
    expect(resolveCohortRewrite("/cohorts/loop-pak-3/angel/reports")).toEqual({
      pathname: "/angel/reports",
      unitSlug: "loop-pak-3",
    });
  });

  it("resolveCohortRewrite는 section이 없으면 루프팩으로 매핑한다", () => {
    expect(resolveCohortRewrite("/cohorts/loop-pak-3")).toEqual({
      pathname: "/loop-pak",
      unitSlug: "loop-pak-3",
    });
  });

  it("resolveCohortRewrite는 지원하지 않는 section을 거부한다", () => {
    expect(resolveCohortRewrite("/cohorts/loop-pak-3/unknown")).toBeNull();
  });

  it("cohortAwarePath는 기존 route href를 cohort URL로 변환한다", () => {
    expect(cohortAwarePath("loop-pak-3", "/afterparty/a-1?date=2026-05-01#settlement")).toBe(
      "/cohorts/loop-pak-3/afterparty/a-1?date=2026-05-01#settlement"
    );
  });

  it("cohortAwarePath는 모임 상세 URL도 cohort URL로 변환한다", () => {
    expect(cohortAwarePath("loop-pak-3", "/meetings/m-1?date=2026-05-01")).toBe(
      "/cohorts/loop-pak-3/meetings/m-1?date=2026-05-01"
    );
  });

  it("cohortAwarePath는 한글 path segment를 이중 인코딩하지 않는다", () => {
    expect(cohortAwarePath("loop-pak-3", "/angel/reports/cycle-1/teams/1팀")).toBe(
      "/cohorts/loop-pak-3/angel/reports/cycle-1/teams/1%ED%8C%80"
    );
  });

  it("cohortAwarePath는 이미 인코딩된 path segment도 한 번만 인코딩된 상태로 유지한다", () => {
    expect(cohortAwarePath("loop-pak-3", "/angel/reports/cycle-1/teams/1%ED%8C%80")).toBe(
      "/cohorts/loop-pak-3/angel/reports/cycle-1/teams/1%ED%8C%80"
    );
  });

  it("cohortAwarePath는 unit이 없으면 기존 href를 유지한다", () => {
    expect(cohortAwarePath("", "/afterparty")).toBe("/afterparty");
  });

  it("cohortAwarePath는 이미 cohort URL이면 다시 감싸지 않는다", () => {
    expect(cohortAwarePath("loop-pak-3", "/cohorts/loop-pak-3/angel")).toBe("/cohorts/loop-pak-3/angel");
  });
});
