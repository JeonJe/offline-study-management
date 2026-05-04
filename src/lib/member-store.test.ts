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

describe("멤버 명단 저장소", () => {
  beforeEach(() => {
    process.env.SKIP_SCHEMA_CHECK = "1";
    queryMock.mockReset();
    transactionQueryMock.mockReset();
    withTransactionMock.mockClear();
  });

  it("한 팀에 같은 이름의 멤버가 있어도 각 멤버 id를 보존한다", async () => {
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

  it("기수별 명단 저장은 다른 기수 데이터를 덮어쓰지 않도록 기수 범위로 upsert한다", async () => {
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

  it("팀이 아직 없어도 엔젤·멘토·매니저·서포터·버디 명단을 저장한다", async () => {
    await saveMemberPresetToDb(
      "loop-pak-3",
      [],
      ["유관순"],
      {
        mentor: ["장영실"],
        manager: ["허준"],
        supporter: ["정약용"],
        buddy: ["신사임당"],
      }
    );

    const teamDelete = transactionQueryMock.mock.calls.find(([sql]) =>
      String(sql).includes("delete from public.member_teams")
    );
    expect(teamDelete?.[1]).toEqual([[], "loop-pak-3"]);

    const angelInsertCalls = transactionQueryMock.mock.calls.filter(([sql]) =>
      String(sql).includes("insert into public.member_angels")
    );
    expect(angelInsertCalls).toHaveLength(1);
    expect(angelInsertCalls[0]?.[1]).toEqual(["유관순", 0, "loop-pak-3"]);

    const specialRoleInsertCalls = transactionQueryMock.mock.calls.filter(([sql]) =>
      String(sql).includes("insert into public.member_special_roles")
    );
    expect(specialRoleInsertCalls.map(([, params]) => params)).toEqual([
      ["supporter", "정약용", 0, "loop-pak-3"],
      ["buddy", "신사임당", 0, "loop-pak-3"],
      ["mentor", "장영실", 0, "loop-pak-3"],
      ["manager", "허준", 0, "loop-pak-3"],
    ]);
  });

  it("빈 명단 저장은 팀과 운영진 명단을 모두 비우는 동작으로 처리한다", async () => {
    await saveMemberPresetToDb("loop-pak-3", [], [], {});

    const teamDelete = transactionQueryMock.mock.calls.find(([sql]) =>
      String(sql).includes("delete from public.member_teams")
    );
    expect(teamDelete?.[1]).toEqual([[], "loop-pak-3"]);

    const angelDelete = transactionQueryMock.mock.calls.find(([sql]) =>
      String(sql).includes("delete from public.member_angels")
    );
    expect(angelDelete?.[1]).toEqual([[], "loop-pak-3"]);

    const specialRoleDeleteCalls = transactionQueryMock.mock.calls.filter(([sql]) =>
      String(sql).includes("delete from public.member_special_roles")
    );
    expect(specialRoleDeleteCalls.map(([, params]) => params)).toEqual([
      ["supporter", [], "loop-pak-3"],
      ["buddy", [], "loop-pak-3"],
      ["mentor", [], "loop-pak-3"],
      ["manager", [], "loop-pak-3"],
    ]);
  });

});
