import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, unstableCacheMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  unstableCacheMock: vi.fn(
    (...args: [fn: () => unknown, keys?: unknown[], options?: unknown]) => args[0]
  ),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

vi.mock("@/lib/operating-unit-store", () => ({
  DEFAULT_OPERATING_UNIT_SLUG: "loop-pak-3",
  ensureOperatingUnitSchema: vi.fn().mockResolvedValue(undefined),
  ensureOperatingUnitColumn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/meetup-store", () => ({
  ensureSchema: vi.fn().mockResolvedValue(undefined),
  // cached-queries가 import하는 함수들 stub
  listMeetings: vi.fn(),
  listMeetingsByDate: vi.fn(),
  getMeetingById: vi.fn(),
  listRsvpsForMeetings: vi.fn(),
}));

vi.mock("@/lib/afterparty-store", () => ({
  ensureAfterpartySchema: vi.fn().mockResolvedValue(undefined),
  // cached-queries가 import하는 함수들 stub
  listAfterparties: vi.fn(),
  listAfterpartiesByDate: vi.fn(),
  getAfterpartyById: vi.fn(),
  listParticipantsForAfterparties: vi.fn(),
  listSettlementsForAfterparty: vi.fn(),
  listSettlementsForAfterparties: vi.fn(),
  listParticipantsForSettlement: vi.fn(),
}));

vi.mock("@/lib/member-store", () => ({
  loadMemberPreset: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: unstableCacheMock,
}));

import {
  getTeamAttendanceByPeriod,
  getMemberAttendanceByPeriod,
} from "@/lib/history-store";

describe("history-store", () => {
  beforeEach(() => {
    queryMock.mockReset();
    unstableCacheMock.mockClear();
  });

  describe("getTeamAttendanceByPeriod", () => {
    it("#1 빈 기간 — 모임 0건이면 빈 배열 반환", async () => {
      // meetings 쿼리 → 빈 배열
      queryMock.mockResolvedValueOnce([]);

      const result = await getTeamAttendanceByPeriod("2026-01-01", "2026-01-31");

      expect(result).toEqual([]);
      // meetings 조회 1회만 호출 (팀/rsvp 쿼리 불필요)
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("#2 단일 모임 + 팀 참석", async () => {
      const meetingId = "aaaaaaaa-0000-0000-0000-000000000001";

      // 1) meetings 쿼리 → 1건
      queryMock.mockResolvedValueOnce([{ id: meetingId }]);

      // 2) 팀별 attended 집계 쿼리 → 팀A 1회, 팀B 0회
      queryMock.mockResolvedValueOnce([
        { team: "팀A", attended: "1" },
        { team: "팀B", attended: "0" },
      ]);

      const result = await getTeamAttendanceByPeriod("2026-03-01", "2026-03-31");

      expect(result).toHaveLength(2);

      const teamA = result.find((r) => r.team === "팀A")!;
      expect(teamA.meetings).toBe(1);
      expect(teamA.attended).toBe(1);
      expect(teamA.rate).toBe(1.0);

      const teamB = result.find((r) => r.team === "팀B")!;
      expect(teamB.meetings).toBe(1);
      expect(teamB.attended).toBe(0);
      expect(teamB.rate).toBe(0);
    });

    it("#3 다중 모임 — rate 계산 정확성", async () => {
      const ids = [
        "bbbbbbbb-0000-0000-0000-000000000001",
        "bbbbbbbb-0000-0000-0000-000000000002",
        "bbbbbbbb-0000-0000-0000-000000000003",
      ];

      // 1) meetings 쿼리 → 3건
      queryMock.mockResolvedValueOnce(ids.map((id) => ({ id })));

      // 2) 팀별 attended 집계 쿼리 → 팀A 2회/3회
      queryMock.mockResolvedValueOnce([
        { team: "팀A", attended: "2" },
      ]);

      const result = await getTeamAttendanceByPeriod("2026-01-01", "2026-03-31");

      expect(result).toHaveLength(1);
      const teamA = result[0];
      expect(teamA.meetings).toBe(3);
      expect(teamA.attended).toBe(2);
      // rate = round(2/3 * 100) / 100 = 0.67
      expect(teamA.rate).toBe(0.67);
    });

    it("#4 operatingUnitSlug 분기 — 명시 인자 전달 시 두 쿼리 모두에 slug가 파라미터로 반영된다", async () => {
      const customSlug = "4기";
      const meetingId = "cccccccc-0000-0000-0000-000000000001";

      // 1) meetings 쿼리 → 1건
      queryMock.mockResolvedValueOnce([{ id: meetingId }]);
      // 2) 팀별 attended 집계 쿼리 → 팀A 1회
      queryMock.mockResolvedValueOnce([{ team: "팀A", attended: "1" }]);

      await getTeamAttendanceByPeriod("2026-03-01", "2026-03-31", customSlug);

      // meetings 쿼리: [start, end, operatingUnitSlug]
      const meetingsParams = queryMock.mock.calls[0][1];
      expect(meetingsParams[2]).toBe(customSlug);

      // team-rsvp 쿼리: [meetingIds, operatingUnitSlug]
      const teamParams = queryMock.mock.calls[1][1];
      expect(teamParams[1]).toBe(customSlug);
    });
  });

  describe("getMemberAttendanceByPeriod", () => {
    it("#1 빈 기간 — 두 쿼리 모두 빈 배열이면 빈 배열 반환", async () => {
      // 모임 참석 쿼리 → 빈 배열
      queryMock.mockResolvedValueOnce([]);
      // 뒷풀이 참석 쿼리 → 빈 배열
      queryMock.mockResolvedValueOnce([]);

      const result = await getMemberAttendanceByPeriod("2026-01-01", "2026-01-31");

      expect(result).toEqual([]);
    });

    it("#2 단일 모임 + rsvp 2명, 뒷풀이 없음", async () => {
      // 모임 참석 쿼리 → 2명
      queryMock.mockResolvedValueOnce([
        { name: "alice", meetings: "1" },
        { name: "bob", meetings: "1" },
      ]);
      // 뒷풀이 참석 쿼리 → 빈 배열
      queryMock.mockResolvedValueOnce([]);

      const result = await getMemberAttendanceByPeriod("2026-03-01", "2026-03-31");

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.name === "alice")).toEqual({
        name: "alice",
        meetings: 1,
        afterparties: 0,
      });
      expect(result.find((r) => r.name === "bob")).toEqual({
        name: "bob",
        meetings: 1,
        afterparties: 0,
      });
    });

    it("#3 다중 모임 + 뒷풀이 — afterparties 카운트 정확성 및 Map merge", async () => {
      // 모임 참석 쿼리 → 3명 (alice 3회, bob 2회, carol 1회)
      queryMock.mockResolvedValueOnce([
        { name: "alice", meetings: "3" },
        { name: "bob", meetings: "2" },
        { name: "carol", meetings: "1" },
      ]);
      // 뒷풀이 참석 쿼리 → alice 2회, dave 1회 (dave는 모임 미참석)
      queryMock.mockResolvedValueOnce([
        { name: "alice", afterparties: "2" },
        { name: "dave", afterparties: "1" },
      ]);

      const result = await getMemberAttendanceByPeriod("2026-01-01", "2026-03-31");

      expect(result).toHaveLength(4);

      const alice = result.find((r) => r.name === "alice")!;
      expect(alice.meetings).toBe(3);
      expect(alice.afterparties).toBe(2);

      const bob = result.find((r) => r.name === "bob")!;
      expect(bob.meetings).toBe(2);
      expect(bob.afterparties).toBe(0);

      const carol = result.find((r) => r.name === "carol")!;
      expect(carol.meetings).toBe(1);
      expect(carol.afterparties).toBe(0);

      // dave는 모임 미참석이지만 뒷풀이만 참석 → merge되어야 함
      const dave = result.find((r) => r.name === "dave")!;
      expect(dave.meetings).toBe(0);
      expect(dave.afterparties).toBe(1);
    });
  });

  describe("cache 래퍼 (cached-queries)", () => {
    it("cachedGetTeamAttendanceByPeriod — unstable_cache 키/태그가 입력에 따라 구성된다", async () => {
      const { cachedGetTeamAttendanceByPeriod } = await import(
        "@/lib/cached-queries"
      );

      // history-store는 정상 호출되어야 하므로 mock 응답 준비
      queryMock.mockResolvedValueOnce([]);

      await cachedGetTeamAttendanceByPeriod("2026-03-01", "2026-03-31", "4기");

      // unstable_cache(fn, keys, options) 시그니처 검증
      const lastCall =
        unstableCacheMock.mock.calls[unstableCacheMock.mock.calls.length - 1];
      expect(lastCall[1]).toEqual([
        "getTeamAttendanceByPeriod",
        "2026-03-01",
        "2026-03-31",
        "4기",
      ]);
      expect(lastCall[2]).toEqual({ tags: ["attendance"], revalidate: 300 });
    });

    it("cachedGetMemberAttendanceByPeriod — operatingUnitSlug 미전달 시 키 끝이 빈 문자열로 정규화된다", async () => {
      const { cachedGetMemberAttendanceByPeriod } = await import(
        "@/lib/cached-queries"
      );

      // 모임/뒷풀이 두 쿼리 모두 빈 응답
      queryMock.mockResolvedValueOnce([]);
      queryMock.mockResolvedValueOnce([]);

      await cachedGetMemberAttendanceByPeriod("2026-03-01", "2026-03-31");

      const lastCall =
        unstableCacheMock.mock.calls[unstableCacheMock.mock.calls.length - 1];
      expect(lastCall[1]).toEqual([
        "getMemberAttendanceByPeriod",
        "2026-03-01",
        "2026-03-31",
        "",
      ]);
      expect(lastCall[2]).toEqual({ tags: ["attendance"], revalidate: 300 });
    });
  });
});
