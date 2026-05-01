import { loadMemberPreset } from "@/lib/member-store";
import {
  type AngelWeeklyReport,
  countCommentsByReportIds,
  getWeeklyReportCycleById,
  listAngelWeeklyReports,
} from "@/lib/weekly-report-store";

type ReportWithCommentCount = AngelWeeklyReport & {
  commentCount: number;
};

function cleanCycleId(cycleId: string): string {
  const normalized = cycleId.trim();
  if (!normalized) {
    throw new Error("보고 주차 ID는 필수입니다.");
  }
  return normalized;
}

function formatOptionalLine(label: string, value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? `  - ${label}: ${normalized}` : null;
}

function buildSubmittedTeamLines(report: ReportWithCommentCount): string[] {
  return [
    `- ${report.teamName}: 제출 (${report.angelName}) / 댓글 ${report.commentCount}개`,
    `  - 팀 현황: ${report.summary}`,
    formatOptionalLine("특이사항", report.notes),
    formatOptionalLine("도움 요청", report.requests),
    formatOptionalLine("다음 할 일", report.actionItems),
  ].filter((line): line is string => Boolean(line));
}

export async function buildCycleShareText(cycleId: string): Promise<string> {
  const id = cleanCycleId(cycleId);
  const [cycle, memberPreset] = await Promise.all([
    getWeeklyReportCycleById(id),
    loadMemberPreset(),
  ]);

  if (!cycle) {
    throw new Error("보고 주차를 찾을 수 없습니다.");
  }

  const reports = await listAngelWeeklyReports(cycle.id);
  const commentCountByReportId = await countCommentsByReportIds(
    reports.map((report) => report.id)
  );
  const reportsWithCommentCounts: ReportWithCommentCount[] = reports.map(
    (report) => ({
      ...report,
      commentCount: commentCountByReportId.get(report.id) ?? 0,
    })
  );
  const reportByTeam = new Map(
    reportsWithCommentCounts.map((report) => [report.teamName, report])
  );
  const presetTeamNames = new Set(memberPreset.teamGroups.map((team) => team.teamName));
  const extraReports = reportsWithCommentCounts
    .filter((report) => !presetTeamNames.has(report.teamName))
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "ko"));

  const lines: string[] = [
    `[주간 보고] ${cycle.title}`,
    `${cycle.weekLabel}${cycle.dueDate ? ` · 마감 ${cycle.dueDate}` : ""}`,
    `제출 ${reports.length}/${memberPreset.teamGroups.length}팀`,
    "",
  ];

  for (const team of memberPreset.teamGroups) {
    const report = reportByTeam.get(team.teamName);
    if (report) {
      lines.push(...buildSubmittedTeamLines(report));
    } else {
      const angels = team.angels.length > 0 ? team.angels.join(", ") : "미지정";
      lines.push(`- ${team.teamName}: 미제출 / 엔젤 ${angels}`);
    }
  }

  for (const report of extraReports) {
    lines.push(...buildSubmittedTeamLines(report));
  }

  return lines.join("\n").trim();
}
