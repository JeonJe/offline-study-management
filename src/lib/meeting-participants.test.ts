import { describe, expect, it } from "vitest";
import {
  compareParticipantQuickAddEntries,
  compareTeamLabels,
  normalizeMeetingParticipantName,
  sortRsvpsForRole,
} from "@/lib/meeting-participants";
import type { RsvpRecord } from "@/lib/meetup-store";

function rsvp(name: string, role: RsvpRecord["role"] = "student"): RsvpRecord {
  return {
    id: `rsvp-${name}`,
    meetingId: "meeting-1",
    name,
    role,
    note: "",
    status: "confirmed",
    createdAt: "2026-05-03T00:00:00.000Z",
  };
}

describe("meeting participant helpers", () => {
  it("normalizes labels used by quick-add and participant grouping", () => {
    expect(normalizeMeetingParticipantName("1 홍길동 (멘토)")).toBe("홍길동");
  });

  it("orders numeric team labels before unclassified labels", () => {
    expect(compareTeamLabels("2팀", "10팀")).toBeLessThan(0);
    expect(compareTeamLabels("10팀", "미분류")).toBeLessThan(0);
  });

  it("sorts students by team order and normalized name", () => {
    const teamLabelByName = new Map([
      ["정약용", "2팀"],
      ["장보고", "1팀"],
      ["홍길동", "1팀"],
    ]);

    const sorted = sortRsvpsForRole(
      [rsvp("정약용"), rsvp("홍길동"), rsvp("장보고")],
      "student",
      teamLabelByName
    );

    expect(sorted.map((row) => row.name)).toEqual(["장보고", "홍길동", "정약용"]);
  });

  it("sorts quick-add entries by role, team, and name", () => {
    const teamLabelByName = new Map([
      ["정약용", "2팀"],
      ["이순신", "1팀"],
      ["이황", "1팀"],
    ]);
    const entries = [
      { name: "이황", role: "student" as const },
      { name: "정약용", role: "angel" as const },
      { name: "이순신", role: "angel" as const },
    ];

    expect([...entries].sort((a, b) => compareParticipantQuickAddEntries(a, b, teamLabelByName))).toEqual([
      { name: "이순신", role: "angel" },
      { name: "정약용", role: "angel" },
      { name: "이황", role: "student" },
    ]);
  });
});
