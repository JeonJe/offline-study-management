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
  requireOperatingUnitSlug: vi.fn((slug: string) => slug.trim()),
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
  getTeamAttendanceDetailByPeriod,
  getMemberAttendanceByPeriod,
  getMemberAttendanceDetailByPeriod,
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

      const result = await getTeamAttendanceByPeriod("2026-01-01", "2026-01-31", "loop-pak-3");

      expect(result).toEqual([]);
      // meetings 조회 1회만 호출 (팀/rsvp 쿼리 불필요)
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("#2 단일 모임 + 팀 참석", async () => {
      const meetingId = "aaaaaaaa-0000-0000-0000-000000000001";

      // 1) meetings 쿼리 → 1건
      queryMock.mockResolvedValueOnce([{ id: meetingId }]);

      // 2) 팀원 목록 쿼리
      queryMock.mockResolvedValueOnce([
        { teamName: "팀A", memberName: "장영실" },
        { teamName: "팀B", memberName: "정약용" },
      ]);
      // 3) 기간 내 RSVP 목록 쿼리
      queryMock.mockResolvedValueOnce([{ meetingId, name: "장영실" }]);

      const result = await getTeamAttendanceByPeriod("2026-03-01", "2026-03-31", "loop-pak-3");

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

      // 2) 팀원 목록 쿼리
      queryMock.mockResolvedValueOnce([
        { teamName: "팀A", memberName: "장영실" },
      ]);
      // 3) 기간 내 RSVP 목록 쿼리
      queryMock.mockResolvedValueOnce([
        { meetingId: ids[0], name: "장영실" },
        { meetingId: ids[1], name: "장영실" },
      ]);

      const result = await getTeamAttendanceByPeriod("2026-01-01", "2026-03-31", "loop-pak-3");

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
      // 2) 팀원 목록 쿼리
      queryMock.mockResolvedValueOnce([{ teamName: "팀A", memberName: "장영실" }]);
      // 3) 기간 내 RSVP 목록 쿼리
      queryMock.mockResolvedValueOnce([{ meetingId, name: "장영실" }]);

      await getTeamAttendanceByPeriod("2026-03-01", "2026-03-31", customSlug);

      // meetings 쿼리: [start, end, operatingUnitSlug]
      const meetingsParams = queryMock.mock.calls[0][1];
      expect(meetingsParams[2]).toBe(customSlug);

      // 팀원 쿼리: [operatingUnitSlug]
      const teamParams = queryMock.mock.calls[1][1];
      expect(teamParams[0]).toBe(customSlug);

      // RSVP 쿼리: [meetingIds]
      const rsvpParams = queryMock.mock.calls[2][1];
      expect(rsvpParams[0]).toEqual([meetingId]);
    });
  });

  describe("getTeamAttendanceDetailByPeriod", () => {
    it("빈 팀명이면 상세 내역 없이 반환한다", async () => {
      const result = await getTeamAttendanceDetailByPeriod("   ", "2026-04-01", "2026-04-30", "loop-pak-3");

      expect(result).toEqual({
        team: "",
        meetings: 0,
        attended: 0,
        rate: 0,
        members: [],
        items: [],
      });
      expect(queryMock).not.toHaveBeenCalled();
    });

    it("팀원과 모임별 참석자를 기간과 목록 기준으로 반환한다", async () => {
      queryMock.mockResolvedValueOnce([
        { memberName: "장영실" },
        { memberName: "신사임당" },
      ]);
      queryMock.mockResolvedValueOnce([
        {
          id: "meeting-2",
          title: "두 번째 모임",
          eventDate: "2026-04-18",
          startTime: "13:00",
        },
        {
          id: "meeting-1",
          title: "첫 모임",
          eventDate: "2026-04-11",
          startTime: "13:00",
        },
      ]);
      queryMock.mockResolvedValueOnce([
        { meetingId: "meeting-1", name: "장영실" },
        { meetingId: "meeting-1", name: "신사임당" },
      ]);

      const result = await getTeamAttendanceDetailByPeriod(
        "1팀",
        "2026-04-01",
        "2026-04-30",
        "loop-pak-4"
      );

      expect(queryMock).toHaveBeenCalledTimes(3);
      expect(queryMock.mock.calls[0][1]).toEqual(["1팀", "loop-pak-4"]);
      expect(queryMock.mock.calls[1][1]).toEqual([
        "2026-04-01",
        "2026-04-30",
        "loop-pak-4",
      ]);
      expect(queryMock.mock.calls[2][1]).toEqual([
        ["meeting-2", "meeting-1"],
        ["장영실".toLowerCase(), "신사임당".toLowerCase()],
      ]);
      expect(result.members).toEqual(["장영실", "신사임당"]);
      expect(result.meetings).toBe(2);
      expect(result.attended).toBe(1);
      expect(result.rate).toBe(0.5);
      expect(result.items[1].attendees).toEqual(["신사임당", "장영실"]);
    });
  });

  describe("getMemberAttendanceByPeriod", () => {
    it("#1 빈 기간 — 두 쿼리 모두 빈 배열이면 빈 배열 반환", async () => {
      // 모임 참석 쿼리 → 빈 배열
      queryMock.mockResolvedValueOnce([]);
      // 뒷풀이 참석 쿼리 → 빈 배열
      queryMock.mockResolvedValueOnce([]);

      const result = await getMemberAttendanceByPeriod("2026-01-01", "2026-01-31", "loop-pak-3");

      expect(result).toEqual([]);
    });

    it("#2 단일 모임 + rsvp 2명, 뒷풀이 없음", async () => {
      // 모임 참석 쿼리 → 2명
      queryMock.mockResolvedValueOnce([
        { name: "장영실", meetings: "1" },
        { name: "정약용", meetings: "1" },
      ]);
      // 뒷풀이 참석 쿼리 → 빈 배열
      queryMock.mockResolvedValueOnce([]);

      const result = await getMemberAttendanceByPeriod("2026-03-01", "2026-03-31", "loop-pak-3");

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.name === "장영실")).toEqual({
        name: "장영실",
        meetings: 1,
        afterparties: 0,
      });
      expect(result.find((r) => r.name === "정약용")).toEqual({
        name: "정약용",
        meetings: 1,
        afterparties: 0,
      });
    });

    it("#3 다중 모임 + 뒷풀이 — afterparties 카운트 정확성 및 Map merge", async () => {
      // 모임 참석 쿼리 → 3명
      queryMock.mockResolvedValueOnce([
        { name: "장영실", meetings: "3" },
        { name: "정약용", meetings: "2" },
        { name: "이황", meetings: "1" },
      ]);
      // 뒷풀이 참석 쿼리 → 모임 참석자 1명 + 뒷풀이 전용 참석자 1명
      queryMock.mockResolvedValueOnce([
        { name: "장영실", afterparties: "2" },
        { name: "이이", afterparties: "1" },
      ]);

      const result = await getMemberAttendanceByPeriod("2026-01-01", "2026-03-31", "loop-pak-3");

      expect(result).toHaveLength(4);

      const jang = result.find((r) => r.name === "장영실")!;
      expect(jang.meetings).toBe(3);
      expect(jang.afterparties).toBe(2);

      const jeong = result.find((r) => r.name === "정약용")!;
      expect(jeong.meetings).toBe(2);
      expect(jeong.afterparties).toBe(0);

      const hwang = result.find((r) => r.name === "이황")!;
      expect(hwang.meetings).toBe(1);
      expect(hwang.afterparties).toBe(0);

      // 이이는 모임 미참석이지만 뒷풀이만 참석 → merge되어야 함
      const yi = result.find((r) => r.name === "이이")!;
      expect(yi.meetings).toBe(0);
      expect(yi.afterparties).toBe(1);
    });
  });

  describe("getMemberAttendanceDetailByPeriod", () => {
    it("빈 이름이면 상세 내역 없이 반환한다", async () => {
      const result = await getMemberAttendanceDetailByPeriod("   ", "2026-04-01", "2026-04-30", "loop-pak-3");

      expect(result).toEqual({
        name: "",
        meetings: 0,
        afterparties: 0,
        totalMeetings: 0,
        totalAfterparties: 0,
        items: [],
      });
      expect(queryMock).not.toHaveBeenCalled();
    });

    it("모임과 뒷풀이 참여 내역을 같은 기간과 목록 기준으로 합쳐 최신순으로 반환한다", async () => {
      queryMock.mockResolvedValueOnce([
        {
          id: "meeting-1",
          kind: "meeting",
          title: "오프라인 수료식",
          eventDate: "2026-04-18",
          startTime: "19:00",
          role: "member",
        },
      ]);
      queryMock.mockResolvedValueOnce([
        {
          id: "afterparty-1",
          kind: "afterparty",
          title: "뒷풀이",
          eventDate: "2026-04-18",
          startTime: "21:30",
          role: "member",
        },
      ]);
      queryMock.mockResolvedValueOnce([{ count: "3" }]);
      queryMock.mockResolvedValueOnce([{ count: "2" }]);

      const result = await getMemberAttendanceDetailByPeriod(
        " 장영실 ",
        "2026-04-01",
        "2026-04-30",
        "loop-pak-4"
      );

      expect(queryMock).toHaveBeenCalledTimes(4);
      expect(queryMock.mock.calls[0][1]).toEqual([
        "장영실",
        "2026-04-01",
        "2026-04-30",
        "loop-pak-4",
      ]);
      expect(queryMock.mock.calls[1][1]).toEqual([
        "장영실",
        "2026-04-01",
        "2026-04-30",
        "loop-pak-4",
      ]);
      expect(queryMock.mock.calls[2][1]).toEqual([
        "2026-04-01",
        "2026-04-30",
        "loop-pak-4",
      ]);
      expect(queryMock.mock.calls[3][1]).toEqual([
        "2026-04-01",
        "2026-04-30",
        "loop-pak-4",
      ]);
      expect(result.meetings).toBe(1);
      expect(result.afterparties).toBe(1);
      expect(result.totalMeetings).toBe(3);
      expect(result.totalAfterparties).toBe(2);
      expect(result.items.map((item) => item.kind)).toEqual(["afterparty", "meeting"]);
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

    it("cachedGetMemberAttendanceByPeriod — 명시 운영 단위를 캐시 키에 포함한다", async () => {
      const { cachedGetMemberAttendanceByPeriod } = await import(
        "@/lib/cached-queries"
      );

      // 모임/뒷풀이 두 쿼리 모두 빈 응답
      queryMock.mockResolvedValueOnce([]);
      queryMock.mockResolvedValueOnce([]);

      await cachedGetMemberAttendanceByPeriod("2026-03-01", "2026-03-31", "loop-pak-3");

      const lastCall =
        unstableCacheMock.mock.calls[unstableCacheMock.mock.calls.length - 1];
      expect(lastCall[1]).toEqual([
        "getMemberAttendanceByPeriod",
        "2026-03-01",
        "2026-03-31",
        "loop-pak-3",
      ]);
      expect(lastCall[2]).toEqual({ tags: ["attendance"], revalidate: 300 });
    });

    it("cachedGetTeamAttendanceDetailByPeriod — 팀/기간/운영 단위별로 캐시 키를 분리한다", async () => {
      const { cachedGetTeamAttendanceDetailByPeriod } = await import(
        "@/lib/cached-queries"
      );

      queryMock.mockResolvedValueOnce([]);
      queryMock.mockResolvedValueOnce([]);

      await cachedGetTeamAttendanceDetailByPeriod("1팀", "2026-04-01", "2026-04-30", "loop-pak-3");

      const lastCall =
        unstableCacheMock.mock.calls[unstableCacheMock.mock.calls.length - 1];
      expect(lastCall[1]).toEqual([
        "getTeamAttendanceDetailByPeriod",
        "1팀",
        "2026-04-01",
        "2026-04-30",
        "loop-pak-3",
      ]);
      expect(lastCall[2]).toEqual({ tags: ["attendance"], revalidate: 300 });
    });

    it("cachedGetMemberAttendanceDetailByPeriod — 멤버/기간/운영 단위별로 캐시 키를 분리한다", async () => {
      const { cachedGetMemberAttendanceDetailByPeriod } = await import(
        "@/lib/cached-queries"
      );

      queryMock.mockResolvedValueOnce([]);
      queryMock.mockResolvedValueOnce([]);
      queryMock.mockResolvedValueOnce([{ count: "0" }]);
      queryMock.mockResolvedValueOnce([{ count: "0" }]);

      await cachedGetMemberAttendanceDetailByPeriod("정약용", "2026-04-01", "2026-04-30", "loop-pak-3");

      const lastCall =
        unstableCacheMock.mock.calls[unstableCacheMock.mock.calls.length - 1];
      expect(lastCall[1]).toEqual([
        "getMemberAttendanceDetailByPeriod",
        "정약용",
        "2026-04-01",
        "2026-04-30",
        "loop-pak-3",
      ]);
      expect(lastCall[2]).toEqual({ tags: ["attendance"], revalidate: 300 });
    });
  });
});
