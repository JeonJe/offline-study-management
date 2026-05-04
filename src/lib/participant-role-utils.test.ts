import { describe, expect, it } from "vitest";
import {
  buildRoleMatchSet,
  isParticipantRole,
  normalizeParticipantName,
  PARTICIPANT_ROLE_META,
  resolveRoleByName,
} from "@/lib/participant-role-utils";

describe("participant-role-utils", () => {
  it("normalizes participant names for matching", () => {
    expect(normalizeParticipantName(" 2팀 세종대왕 (매니저) ")).toBe("세종대왕");
    expect(normalizeParticipantName(" 7팀   장보고 ")).toBe("장보고");
  });

  it("validates participant roles", () => {
    expect(isParticipantRole("angel")).toBe(true);
    expect(isParticipantRole("student")).toBe(true);
    expect(isParticipantRole("owner")).toBe(false);
  });

  it("resolves special roles by name", () => {
    const angelSet = new Set<string>();
    expect(resolveRoleByName("세종대왕", angelSet)).toBe("manager");
    expect(resolveRoleByName("유관순", angelSet)).toBe("supporter");
    expect(resolveRoleByName("허준", angelSet)).toBe("buddy");
    expect(resolveRoleByName("장영실", angelSet)).toBe("mentor");
  });

  it("keeps mentor priority over angel set", () => {
    const angelSet = new Set<string>(["장영실"]);
    expect(resolveRoleByName("장영실", angelSet)).toBe("mentor");
  });

  it("resolves angel and fallback student", () => {
    const angelSet = new Set<string>(["이순신"]);
    expect(resolveRoleByName("이순신", angelSet)).toBe("angel");
    expect(resolveRoleByName("홍길동", angelSet)).toBe("student");
  });

  it("contains manager meta", () => {
    expect(PARTICIPANT_ROLE_META.manager.label).toBe("매니저");
    expect(PARTICIPANT_ROLE_META.manager.emoji).toBeTruthy();
  });

  it("uses member preset role set when provided", () => {
    const angelSet = new Set<string>();
    const roleMatchSet = buildRoleMatchSet({ manager: ["정조"] });
    expect(resolveRoleByName("정조", angelSet, roleMatchSet)).toBe("manager");
    expect(resolveRoleByName("세종대왕", angelSet, roleMatchSet)).toBe("student");
  });
});
