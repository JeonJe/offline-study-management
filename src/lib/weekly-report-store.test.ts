import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

import {
  createWeeklyReportCycle,
  createWeeklyReportTemplate,
  updateWeeklyReportCycle,
  upsertAngelWeeklyReport,
} from "@/lib/weekly-report-store";

describe("weekly report store", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockImplementation(async (text: string) => {
      if (text.includes("to_regclass('public.weekly_report_cycles')")) {
        return [
          {
            cycles: "public.weekly_report_cycles",
            reports: "public.angel_weekly_reports",
          },
        ];
      }

      if (text.includes("insert into public.weekly_report_cycles")) {
        return [
          {
            id: "cycle-1",
            templateId: null,
            title: "4기 3주차 엔젤 보고",
            weekLabel: "3주차",
            startDate: "2026-04-20",
            dueDate: "2026-04-26",
            prompt: "팀 분위기 중심으로 작성",
            status: "open",
            reportCount: 0,
            createdAt: "2026-04-27",
          },
        ];
      }

      if (text.includes("insert into public.weekly_report_templates")) {
        return [
          {
            id: "template-1",
            name: "기본 템플릿",
            prompt: "팀 분위기 중심으로 작성",
            sections: [
              {
                key: "summary",
                title: "팀 현황",
                prompt: "참여 흐름을 적어주세요.",
                required: false,
              },
            ],
            isDefault: false,
            createdAt: "2026-04-27",
          },
        ];
      }

      if (text.includes("update public.weekly_report_cycles")) {
        return [
          {
            id: "cycle-1",
            templateId: null,
            title: "4기 4주차 엔젤 보고",
            weekLabel: "4주차",
            startDate: "2026-04-27",
            dueDate: "2026-05-03",
            prompt: "수정된 작성 기준",
            status: "open",
            reportCount: 0,
            createdAt: "2026-04-27",
          },
        ];
      }

      if (text.includes("insert into public.angel_weekly_reports")) {
        return [
          {
            id: "report-1",
            cycleId: "cycle-1",
            angelName: "유관순",
            teamName: "1팀",
            summary: "참여 흐름이 안정적입니다.",
            notes: null,
            requests: "장소 안내가 필요합니다.",
            actionItems: null,
            submittedAt: "2026-04-27",
            updatedAt: "2026-04-27",
          },
        ];
      }

      return [];
    });
  });

  it("creates a weekly report cycle with normalized optional fields", async () => {
    await createWeeklyReportCycle({
      operatingUnitSlug: "loop-pak-4",
      title: "  4기 3주차 엔젤 보고  ",
      weekLabel: "  3주차  ",
      startDate: "2026-04-20",
      dueDate: "not-a-date",
      prompt: " 팀 분위기 중심으로 작성 ",
    });

    const insertCall = queryMock.mock.calls.find((call) =>
      String(call[0]).includes("insert into public.weekly_report_cycles")
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]).toEqual([
      expect.any(String),
      null,
      "4기 3주차 엔젤 보고",
      "3주차",
      "2026-04-20",
      null,
      "팀 분위기 중심으로 작성",
      "loop-pak-4",
    ]);
  });

  it("creates a weekly report template", async () => {
    await createWeeklyReportTemplate({
      operatingUnitSlug: "loop-pak-4",
      name: " 기본 템플릿 ",
      prompt: " 팀 분위기 중심으로 작성 ",
      summaryTitle: " 팀 현황 ",
      summaryPrompt: " 참여 흐름을 적어주세요. ",
    });

    const insertCall = queryMock.mock.calls.find((call) =>
      String(call[0]).includes("insert into public.weekly_report_templates")
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]).toEqual([
      expect.any(String),
      "기본 템플릿",
      "팀 분위기 중심으로 작성",
      JSON.stringify([
        {
          key: "summary",
          title: "팀 현황",
          prompt: "참여 흐름을 적어주세요.",
          required: false,
        },
      ]),
      "loop-pak-4",
    ]);
  });

  it("updates a weekly report cycle", async () => {
    await updateWeeklyReportCycle({
      operatingUnitSlug: "loop-pak-4",
      id: "cycle-1",
      title: " 4기 4주차 엔젤 보고 ",
      weekLabel: " 4주차 ",
      startDate: "2026-04-27",
      dueDate: "2026-05-03",
      prompt: " 수정된 작성 기준 ",
    });

    const updateCall = queryMock.mock.calls.find((call) =>
      String(call[0]).includes("update public.weekly_report_cycles")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall?.[1]).toEqual([
      "cycle-1",
      null,
      "4기 4주차 엔젤 보고",
      "4주차",
      "2026-04-27",
      "2026-05-03",
      "수정된 작성 기준",
      "loop-pak-4",
    ]);
  });

  it("upserts an angel weekly report", async () => {
    await upsertAngelWeeklyReport({
      operatingUnitSlug: "loop-pak-4",
      cycleId: "cycle-1",
      angelName: " 유관순 ",
      teamName: " 1팀 ",
      summary: " 참여 흐름이 안정적입니다. ",
      notes: "",
      requests: " 장소 안내가 필요합니다. ",
      actionItems: "",
    });

    const insertCall = queryMock.mock.calls.find((call) =>
      String(call[0]).includes("insert into public.angel_weekly_reports")
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]).toEqual([
      expect.any(String),
      "cycle-1",
      "유관순",
      "1팀",
      "참여 흐름이 안정적입니다.",
      null,
      "장소 안내가 필요합니다.",
      null,
      "loop-pak-4",
    ]);
  });
});
