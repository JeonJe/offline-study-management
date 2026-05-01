import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

import {
  _resetSchemaStateForTesting,
  addComment,
  countCommentsByReportIds,
  createWeeklyReportCycle,
  createWeeklyReportTemplate,
  listComments,
  softDeleteComment,
  updateWeeklyReportCycle,
  upsertAngelWeeklyReport,
} from "@/lib/weekly-report-store";
import type { WeeklyReportCommentAuthorRole } from "@/lib/weekly-report-store";

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
                required: true,
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
            angelName: "애니",
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
      "3기",
    ]);
  });

  it("creates a weekly report template", async () => {
    await createWeeklyReportTemplate({
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
          required: true,
        },
      ]),
      "3기",
    ]);
  });

  it("updates a weekly report cycle", async () => {
    await updateWeeklyReportCycle({
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
      "3기",
    ]);
  });

  it("upserts an angel weekly report", async () => {
    await upsertAngelWeeklyReport({
      cycleId: "cycle-1",
      angelName: " 애니 ",
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
      "애니",
      "1팀",
      "참여 흐름이 안정적입니다.",
      null,
      "장소 안내가 필요합니다.",
      null,
    ]);
  });
});

describe("weekly report comments", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue([]);
    _resetSchemaStateForTesting();
    queryMock.mockImplementation(async (text: string) => {
      if (text.includes("to_regclass('public.weekly_report_cycles')")) {
        return [
          {
            cycles: "public.weekly_report_cycles",
            reports: "public.angel_weekly_reports",
          },
        ];
      }

      if (text.includes("weekly_report_comments")) {
        if (text.includes("insert into")) {
          return [
            {
              id: "comment-1",
              reportId: "report-1",
              authorRole: "angel",
              authorLabel: "애니",
              body: "잘 읽었습니다.",
              createdAt: "2026-04-27T10:00:00.000Z",
            },
          ];
        }

        if (text.includes("select")) {
          return [
            {
              id: "comment-1",
              reportId: "report-1",
              authorRole: "angel",
              authorLabel: "애니",
              body: "잘 읽었습니다.",
              createdAt: "2026-04-27T10:00:00.000Z",
            },
          ];
        }
      }

      return [];
    });
  });

  it("T1: addComment - 정상 입력으로 댓글 생성", async () => {
    const result = await addComment({
      reportId: "report-1",
      authorRole: "angel",
      authorLabel: " 애니 ",
      body: " 잘 읽었습니다. ",
    });

    const insertCall = queryMock.mock.calls.find(([sql]) =>
      sql.includes("insert into public.weekly_report_comments")
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]).toEqual([
      expect.any(String),
      "report-1",
      "angel",
      "애니",
      "잘 읽었습니다.",
    ]);
    expect(result.id).toBe("comment-1");
    expect(result.reportId).toBe("report-1");
    expect(result.authorRole).toBe("angel");
    expect(result.authorLabel).toBe("애니");
    expect(result.body).toBe("잘 읽었습니다.");
    expect(result.createdAt).toBe("2026-04-27T10:00:00.000Z");
  });

  it("T2: addComment - body가 빈 문자열이면 에러", async () => {
    await expect(
      addComment({
        reportId: "report-1",
        authorRole: "angel",
        authorLabel: "애니",
        body: "   ",
      })
    ).rejects.toThrow("댓글 내용은 필수입니다.");
  });

  it("T3: addComment - authorLabel이 빈 문자열이면 에러", async () => {
    await expect(
      addComment({
        reportId: "report-1",
        authorRole: "angel",
        authorLabel: "   ",
        body: "잘 읽었습니다.",
      })
    ).rejects.toThrow("작성자 표시 이름은 필수입니다.");
  });

  it("T1-extra: addComment - reportId가 빈 문자열이면 에러", async () => {
    await expect(
      addComment({
        reportId: "   ",
        authorRole: "angel",
        authorLabel: "애니",
        body: "잘 읽었습니다.",
      })
    ).rejects.toThrow("보고서 ID는 필수입니다.");
  });

  it("T4: listComments - deleted_at IS NULL 필터 포함", async () => {
    await listComments("report-1");

    const selectCall = queryMock.mock.calls.find(([sql]) =>
      sql.includes("weekly_report_comments") && sql.includes("select")
    );
    expect(selectCall).toBeDefined();
    expect(selectCall?.[0]).toContain("deleted_at is null");
    expect(selectCall?.[1]).toEqual(["report-1"]);
  });

  it("countCommentsByReportIds는 삭제되지 않은 댓글 수를 report_id별로 집계한다", async () => {
    await countCommentsByReportIds(["report-1", "report-2", "report-1", "   "]);

    const selectCall = queryMock.mock.calls.find(([sql]) =>
      sql.includes("count(*)::int as \"commentCount\"")
    );
    expect(selectCall).toBeDefined();
    expect(selectCall?.[0]).toContain("report_id = any($1::uuid[])");
    expect(selectCall?.[0]).toContain("deleted_at is null");
    expect(selectCall?.[0]).toContain("group by report_id");
    expect(selectCall?.[1]).toEqual([["report-1", "report-2"]]);
  });

  it("T5: softDeleteComment - deleted_at = now() + deleted_at IS NULL 조건 포함", async () => {
    await softDeleteComment("comment-1");

    const updateCall = queryMock.mock.calls.find(([sql]) =>
      sql.includes("weekly_report_comments") && sql.includes("update")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall?.[0]).toContain("deleted_at = now()");
    expect(updateCall?.[0]).toContain("deleted_at is null");
  });

  it("T6: softDeleteComment - 존재하지 않는 id도 에러 없이 완료 (멱등)", async () => {
    await expect(softDeleteComment("non-existent-id")).resolves.toBeUndefined();
  });

  it("addComment가 admin 역할로 정상 작동한다", async () => {
    await expect(
      addComment({
        reportId: "report-1",
        authorRole: "admin",
        authorLabel: "운영자",
        body: "확인했습니다.",
      })
    ).resolves.toBeDefined();
  });

  it("addComment가 leader 역할로 정상 작동한다", async () => {
    await expect(
      addComment({
        reportId: "report-1",
        authorRole: "leader",
        authorLabel: "리더",
        body: "수고하셨습니다.",
      })
    ).resolves.toBeDefined();
  });

  it("addComment는 알 수 없는 authorRole에 대해 에러를 던진다", async () => {
    await expect(
      addComment({
        reportId: "report-1",
        authorRole: "stranger" as WeeklyReportCommentAuthorRole,
        authorLabel: "낯선이",
        body: "안녕하세요.",
      })
    ).rejects.toThrow("유효하지 않은 작성자 역할입니다.");
  });

  it("softDeleteComment는 빈 댓글 ID에 대해 에러를 던진다", async () => {
    await expect(softDeleteComment("")).rejects.toThrow("댓글 ID는 필수입니다.");
  });

  it("addComment는 body가 4000자를 초과하면 에러를 던진다", async () => {
    await expect(
      addComment({
        reportId: "report-1",
        authorRole: "angel",
        authorLabel: "애니",
        body: "a".repeat(4001),
      })
    ).rejects.toThrow("댓글 내용이 너무 깁니다.");
  });

  it("addComment는 authorLabel이 100자를 초과하면 에러를 던진다", async () => {
    await expect(
      addComment({
        reportId: "report-1",
        authorRole: "angel",
        authorLabel: "a".repeat(101),
        body: "잘 읽었습니다.",
      })
    ).rejects.toThrow("작성자 표시명이 너무 깁니다.");
  });
});
