import { describe, expect, it, vi } from "vitest";

const {
  countCommentsByReportIdsMock,
  getCycleMock,
  listReportsMock,
  loadMemberPresetMock,
} = vi.hoisted(() => ({
    countCommentsByReportIdsMock: vi.fn(),
    getCycleMock: vi.fn(),
    listReportsMock: vi.fn(),
    loadMemberPresetMock: vi.fn(),
  }));

vi.mock("@/lib/member-store", () => ({
  loadMemberPreset: loadMemberPresetMock,
}));

vi.mock("@/lib/weekly-report-store", () => ({
  countCommentsByReportIds: countCommentsByReportIdsMock,
  getWeeklyReportCycleById: getCycleMock,
  listAngelWeeklyReports: listReportsMock,
}));

import { buildCycleShareText } from "@/lib/weekly-report-share-text";

const cycle = {
  id: "cycle-1",
  templateId: null,
  title: "4기 3주차 엔젤 보고",
  weekLabel: "3주차",
  startDate: "2026-04-20",
  dueDate: "2026-04-26",
  prompt: null,
  status: "open",
  reportCount: 0,
  createdAt: "2026-04-20",
};

const memberPreset = {
  teamGroups: [
    { teamName: "1팀", angels: ["애니"], members: ["민수"] },
    { teamName: "2팀", angels: ["보라"], members: ["지수"] },
  ],
  fixedAngels: [],
  specialRoles: {
    supporter: [],
    buddy: [],
    mentor: [],
    manager: [],
  },
  source: "db",
};

function report(teamName: string, id = `${teamName}-report`) {
  return {
    id,
    cycleId: "cycle-1",
    angelName: teamName === "1팀" ? "애니" : "보라",
    teamName,
    summary: `${teamName} 참여 흐름 안정`,
    notes: null,
    requests: teamName === "1팀" ? "장소 안내 필요" : null,
    actionItems: null,
    submittedAt: "2026-04-26",
    updatedAt: "2026-04-26",
  };
}

describe("buildCycleShareText", () => {
  it("cycleId가 비어 있으면 에러를 던진다", async () => {
    await expect(buildCycleShareText("   ")).rejects.toThrow("보고 주차 ID는 필수입니다.");
  });

  it("사이클이 없으면 에러를 던진다", async () => {
    getCycleMock.mockResolvedValue(null);
    loadMemberPresetMock.mockResolvedValue(memberPreset);

    await expect(buildCycleShareText("missing-cycle")).rejects.toThrow(
      "보고 주차를 찾을 수 없습니다."
    );
  });

  it("정상 사이클의 팀별 보고와 댓글 수를 공유 문구로 만든다", async () => {
    getCycleMock.mockResolvedValue(cycle);
    loadMemberPresetMock.mockResolvedValue(memberPreset);
    listReportsMock.mockResolvedValue([report("1팀"), report("2팀")]);
    countCommentsByReportIdsMock.mockResolvedValue(new Map([["1팀-report", 2]]));

    const text = await buildCycleShareText("cycle-1");

    expect(text).toContain("[주간 보고] 4기 3주차 엔젤 보고");
    expect(text).toContain("제출 2/2팀");
    expect(text).toContain("- 1팀: 제출 (애니) / 댓글 2개");
    expect(text).toContain("  - 도움 요청: 장소 안내 필요");
    expect(text).toContain("- 2팀: 제출 (보라) / 댓글 0개");
  });

  it("빈 사이클이면 모든 팀을 미제출로 표시한다", async () => {
    getCycleMock.mockResolvedValue(cycle);
    loadMemberPresetMock.mockResolvedValue(memberPreset);
    listReportsMock.mockResolvedValue([]);
    countCommentsByReportIdsMock.mockResolvedValue(new Map());

    const text = await buildCycleShareText("cycle-1");

    expect(text).toContain("제출 0/2팀");
    expect(text).toContain("- 1팀: 미제출 / 엔젤 애니");
    expect(text).toContain("- 2팀: 미제출 / 엔젤 보라");
  });

  it("일부 미제출 사이클은 제출 팀과 미제출 팀을 함께 표시한다", async () => {
    getCycleMock.mockResolvedValue(cycle);
    loadMemberPresetMock.mockResolvedValue(memberPreset);
    listReportsMock.mockResolvedValue([report("1팀")]);
    countCommentsByReportIdsMock.mockResolvedValue(new Map([["1팀-report", 1]]));

    const text = await buildCycleShareText("cycle-1");

    expect(text).toContain("제출 1/2팀");
    expect(text).toContain("- 1팀: 제출 (애니) / 댓글 1개");
    expect(text).toContain("- 2팀: 미제출 / 엔젤 보라");
  });
});
