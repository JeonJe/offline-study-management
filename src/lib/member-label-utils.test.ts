import { describe, expect, it } from "vitest";
import {
  normalizeMemberName,
  toTeamLabel,
  withTeamLabel,
} from "@/lib/member-label-utils";

describe("member-label-utils", () => {
  it("normalizes member names for key matching", () => {
    expect(normalizeMemberName(" 2팀  홍길동 (신규) ")).toBe("2팀 홍길동");
    expect(normalizeMemberName(" Alice   Kim ")).toBe("alice kim");
  });

  it("extracts team labels from names", () => {
    expect(toTeamLabel("2팀")).toBe("2팀");
    expect(toTeamLabel("3 팀")).toBe("3팀");
    expect(toTeamLabel("Growth Team")).toBe("Growth Team");
    expect(toTeamLabel(" ")).toBe("");
  });

  it("prefixes member names with team label when missing", () => {
    const map = new Map<string, string>([["홍길동", "2팀"]]);
    expect(withTeamLabel("홍길동", map)).toBe("2팀 홍길동");
    expect(withTeamLabel("2팀 홍길동", map)).toBe("2팀 홍길동");
    expect(withTeamLabel("김철수", map)).toBe("김철수");
  });
});
