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
      ["공명선", "2팀"],
      ["김루프", "1팀"],
      ["홍길동", "1팀"],
    ]);

    const sorted = sortRsvpsForRole(
      [rsvp("공명선"), rsvp("홍길동"), rsvp("김루프")],
      "student",
      teamLabelByName
    );

    expect(sorted.map((row) => row.name)).toEqual(["김루프", "홍길동", "공명선"]);
  });

  it("sorts quick-add entries by role, team, and name", () => {
    const teamLabelByName = new Map([
      ["엔젤가", "2팀"],
      ["엔젤나", "1팀"],
      ["학생가", "1팀"],
    ]);
    const entries = [
      { name: "학생가", role: "student" as const },
      { name: "엔젤가", role: "angel" as const },
      { name: "엔젤나", role: "angel" as const },
    ];

    expect([...entries].sort((a, b) => compareParticipantQuickAddEntries(a, b, teamLabelByName))).toEqual([
      { name: "엔젤나", role: "angel" },
      { name: "엔젤가", role: "angel" },
      { name: "학생가", role: "student" },
    ]);
  });
});
