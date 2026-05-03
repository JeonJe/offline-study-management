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
      { teamName: "2팀", members: ["alpha", "beta"], angels: ["angel-b"], memberEntries: undefined },
      { teamName: "10팀", members: ["gamma"], angels: ["angel-a"], memberEntries: undefined },
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
      ["alpha", "2팀"],
      ["bravo", "2팀"],
      ["zulu", "10팀"],
    ]);

    const sorted = sortAfterpartyParticipantsForRole(
      [participant("zulu"), participant("bravo"), participant("alpha")],
      "student",
      teamLabelByMemberName
    );

    expect(sorted.map((row) => row.name)).toEqual(["alpha", "bravo", "zulu"]);
  });

  it("builds participant state with resolved roles and filtered quick-add counts", () => {
    const state = buildAfterpartyParticipantState(
      [
        participant("alpha"),
        participant("gamma"),
        participant("mentor"),
        participant("manager", "student", true),
      ],
      memberPreset(),
      "alp",
      "2팀"
    );

    expect(state.settledCount).toBe(1);
    expect(state.unsettledCount).toBe(3);
    expect(state.sortedParticipantRows.map((row) => `${row.role}:${row.name}`)).toEqual([
      "mentor:mentor",
      "manager:manager",
      "student:alpha",
      "student:gamma",
    ]);
    expect(state.visibleQuickAddGroups).toHaveLength(1);
    expect(state.visibleQuickAddGroups[0]?.teamName).toBe("2팀");
    expect(state.visibleQuickAddGroups[0]?.entries.map((entry) => entry.name)).toEqual(["alpha"]);
    expect(state.assignedCount).toBe(1);
    expect(state.totalAssignableCount).toBe(1);
    expect(state.assignRate).toBe(100);
  });

  it("sorts quick-add entries by role, team, and name", () => {
    const teamLabelByMemberName = new Map([
      ["angel-a", "10팀"],
      ["angel-b", "2팀"],
      ["manager", "2팀"],
    ]);

    const entries = [
      { name: "angel-a", role: "angel" as const },
      { name: "manager", role: "manager" as const },
      { name: "angel-b", role: "angel" as const },
    ];

    expect(
      [...entries].sort((left, right) =>
        compareAfterpartyQuickAddEntries(left, right, teamLabelByMemberName)
      )
    ).toEqual([
      { name: "manager", role: "manager" },
      { name: "angel-b", role: "angel" },
      { name: "angel-a", role: "angel" },
    ]);
  });
});
