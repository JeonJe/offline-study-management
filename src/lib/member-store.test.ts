import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, transactionQueryMock, withTransactionMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  transactionQueryMock: vi.fn(),
  withTransactionMock: vi.fn(async (callback: (query: typeof transactionQueryMock) => Promise<void>) => {
    await callback(transactionQueryMock);
  }),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
}));

import { saveMemberPresetToDb } from "@/lib/member-store";

describe("member-store stable member identity", () => {
  beforeEach(() => {
    process.env.SKIP_SCHEMA_CHECK = "1";
    queryMock.mockReset();
    transactionQueryMock.mockReset();
    withTransactionMock.mockClear();
  });

  it("saves same-name members in one team as distinct member ids", async () => {
    await saveMemberPresetToDb(
      "loop-pak-3",
      [
        {
          teamName: "1팀",
          angels: ["이순신"],
          members: ["세종대왕", "세종대왕"],
          memberEntries: [
            { id: "member-a", name: "세종대왕", order: 0 },
            { id: "member-b", name: "세종대왕", order: 1 },
          ],
        },
      ],
      ["이순신"]
    );

    const memberInsertCalls = transactionQueryMock.mock.calls.filter(([sql]) =>
      String(sql).includes("insert into public.member_team_members")
    );

    expect(memberInsertCalls).toHaveLength(2);
    expect(memberInsertCalls[0]?.[1]).toEqual([
      "1팀",
      "member-a",
      "세종대왕",
      0,
      "loop-pak-3",
    ]);
    expect(memberInsertCalls[1]?.[1]).toEqual([
      "1팀",
      "member-b",
      "세종대왕",
      1,
      "loop-pak-3",
    ]);
  });

  it("scopes roster upserts by operating unit to avoid cross-unit overwrites", async () => {
    await saveMemberPresetToDb(
      "loop-pak-3",
      [
        {
          teamName: "공통팀",
          angels: ["이순신"],
          members: ["세종대왕"],
          memberEntries: [{ id: "member-a", name: "세종대왕", order: 0 }],
        },
      ],
      ["이순신"],
      { mentor: ["멘토"] }
    );

    const teamUpsert = transactionQueryMock.mock.calls.find(([sql]) =>
      String(sql).includes("insert into public.member_teams")
    );
    expect(String(teamUpsert?.[0])).toContain("on conflict (operating_unit_slug, team_name)");

    const angelUpsert = transactionQueryMock.mock.calls.find(([sql]) =>
      String(sql).includes("insert into public.member_angels")
    );
    expect(String(angelUpsert?.[0])).toContain("on conflict (operating_unit_slug, angel_name)");

    const specialRoleUpsert = transactionQueryMock.mock.calls.find(([sql]) =>
      String(sql).includes("insert into public.member_special_roles")
    );
    expect(String(specialRoleUpsert?.[0])).toContain(
      "on conflict (operating_unit_slug, role, member_name)"
    );
  });

});
