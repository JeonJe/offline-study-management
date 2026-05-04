import { describe, expect, it } from "vitest";
import type { AfterpartyParticipant } from "@/lib/afterparty-store";
import type { MemberPreset } from "@/lib/member-store";
import {
  buildAfterpartyParticipantState,
  compareAfterpartyQuickAddEntries,
  sortAfterpartyParticipantsForRole,
  teamOrderFromLabel,
} from "@/lib/afterparty-participants";

function participant(
  name: string,
  role: AfterpartyParticipant["role"] = "student",
  isSettled = false
): AfterpartyParticipant {
  return {
    id: `participant-${name}`,
    afterpartyId: "afterparty-1",
    name,
    role,
    isSettled,
    createdAt: "2026-05-03T00:00:00.000Z",
  };
}

function memberPreset(): MemberPreset {
  return {
    source: "db",
    teamGroups: [
      { teamName: "2팀", members: ["장영실", "정약용"], angels: ["유관순"], memberEntries: undefined },
      { teamName: "10팀", members: ["이황"], angels: ["이순신"], memberEntries: undefined },
    ],
    fixedAngels: ["fixed"],
    specialRoles: {
      supporter: ["supporter"],
      buddy: ["buddy"],
      mentor: ["mentor"],
      manager: ["manager"],
    },
  };
}

describe("afterparty participant helpers", () => {
  it("orders numeric team labels before unclassified labels", () => {
    expect(teamOrderFromLabel("2팀")).toBeLessThan(teamOrderFromLabel("10팀"));
    expect(teamOrderFromLabel("운영진")).toBe(Number.POSITIVE_INFINITY);
  });

  it("sorts students by team label and normalized name", () => {
    const teamLabelByMemberName = new Map([
      ["장영실", "2팀"],
      ["허준", "2팀"],
      ["정조", "10팀"],
    ]);

    const sorted = sortAfterpartyParticipantsForRole(
      [participant("정조"), participant("허준"), participant("장영실")],
      "student",
      teamLabelByMemberName
    );

    expect(sorted.map((row) => row.name)).toEqual(["장영실", "허준", "정조"]);
  });

  it("builds participant state with resolved roles and filtered quick-add counts", () => {
    const state = buildAfterpartyParticipantState(
      [
        participant("장영실"),
        participant("이황"),
        participant("mentor"),
        participant("manager", "student", true),
      ],
      memberPreset(),
      "장",
      "2팀"
    );

    expect(state.settledCount).toBe(1);
    expect(state.unsettledCount).toBe(3);
    expect(state.sortedParticipantRows.map((row) => `${row.role}:${row.name}`)).toEqual([
      "mentor:mentor",
      "manager:manager",
      "student:장영실",
      "student:이황",
    ]);
    expect(state.visibleQuickAddGroups).toHaveLength(1);
    expect(state.visibleQuickAddGroups[0]?.teamName).toBe("2팀");
    expect(state.visibleQuickAddGroups[0]?.entries.map((entry) => entry.name)).toEqual(["장영실"]);
    expect(state.assignedCount).toBe(1);
    expect(state.totalAssignableCount).toBe(1);
    expect(state.assignRate).toBe(100);
  });

  it("sorts quick-add entries by role, team, and name", () => {
    const teamLabelByMemberName = new Map([
      ["이순신", "10팀"],
      ["유관순", "2팀"],
      ["manager", "2팀"],
    ]);

    const entries = [
      { name: "이순신", role: "angel" as const },
      { name: "manager", role: "manager" as const },
      { name: "유관순", role: "angel" as const },
    ];

    expect(
      [...entries].sort((left, right) =>
        compareAfterpartyQuickAddEntries(left, right, teamLabelByMemberName)
      )
    ).toEqual([
      { name: "manager", role: "manager" },
      { name: "유관순", role: "angel" },
      { name: "이순신", role: "angel" },
    ]);
  });
});
