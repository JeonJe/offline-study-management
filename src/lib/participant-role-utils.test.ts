import { describe, expect, it } from "vitest";
import {
  buildRoleMatchSet,
  normalizeParticipantName,
  PARTICIPANT_ROLE_META,
  resolveRoleByName,
} from "@/lib/participant-role-utils";

describe("participant-role-utils", () => {
  it("normalizes participant names for matching", () => {
    expect(normalizeParticipantName(" 2팀 annie (매니저) ")).toBe("annie");
    expect(normalizeParticipantName(" 7팀   김지웅 ")).toBe("김지웅");
  });

  it("resolves special roles by name", () => {
    const angelSet = new Set<string>();
    expect(resolveRoleByName("Annie", angelSet)).toBe("manager");
    expect(resolveRoleByName("엄준서", angelSet)).toBe("supporter");
    expect(resolveRoleByName("변상일", angelSet)).toBe("buddy");
    expect(resolveRoleByName("alen", angelSet)).toBe("mentor");
  });

  it("keeps mentor priority over angel set", () => {
    const angelSet = new Set<string>(["alen"]);
    expect(resolveRoleByName("alen", angelSet)).toBe("mentor");
  });

  it("resolves angel and fallback student", () => {
    const angelSet = new Set<string>(["박기태"]);
    expect(resolveRoleByName("박기태", angelSet)).toBe("angel");
    expect(resolveRoleByName("홍길동", angelSet)).toBe("student");
  });

  it("contains manager meta", () => {
    expect(PARTICIPANT_ROLE_META.manager.label).toBe("매니저");
    expect(PARTICIPANT_ROLE_META.manager.emoji).toBeTruthy();
  });

  it("uses member preset role set when provided", () => {
    const angelSet = new Set<string>();
    const roleMatchSet = buildRoleMatchSet({ manager: ["신규매니저"] });
    expect(resolveRoleByName("신규매니저", angelSet, roleMatchSet)).toBe("manager");
    expect(resolveRoleByName("annie", angelSet, roleMatchSet)).toBe("student");
  });
});
