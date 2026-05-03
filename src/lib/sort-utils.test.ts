import { describe, expect, it } from "vitest";
import {
  compareByText,
  compareNullableText,
  compareText,
  compareTextDesc,
  sortText,
} from "@/lib/sort-utils";

describe("sort-utils", () => {
  it("기본 locale 기반 텍스트 비교 결과를 반환한다", () => {
    expect(compareText("가", "나")).toBeLessThan(0);
  });

  it("입력 배열을 변경하지 않고 정렬된 새 배열을 반환한다", () => {
    const input = ["다", "가", "나"];

    expect(sortText(input)).toEqual(["가", "나", "다"]);
    expect(input).toEqual(["다", "가", "나"]);
  });

  it("객체의 문자열 필드 기준 comparator를 만든다", () => {
    const rows = [{ name: "다" }, { name: "가" }, { name: "나" }];

    expect([...rows].sort(compareByText((row) => row.name))).toEqual([
      { name: "가" },
      { name: "나" },
      { name: "다" },
    ]);
  });

  it("빈 문자열 포함 텍스트도 기본 locale로 비교한다", () => {
    expect(["나", "", "가"].sort(compareNullableText)).toEqual(["", "가", "나"]);
  });

  it("텍스트 내림차순 comparator를 제공한다", () => {
    expect(["2026-01-01", "2026-03-01", "2026-02-01"].sort(compareTextDesc)).toEqual([
      "2026-03-01",
      "2026-02-01",
      "2026-01-01",
    ]);
  });
});
