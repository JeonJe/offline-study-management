import Link from "next/link";
import { redirect } from "next/navigation";
import { OfflineStudyCopyTextButton } from "@/app/offline-study-copy-text-button";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticated } from "@/lib/auth";
import {
  type TeamMemberGroup,
  loadMemberPreset,
} from "@/lib/member-store";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";
import { buildCycleShareText } from "@/lib/weekly-report-share-text";
import {
  type AngelWeeklyReport,
  type WeeklyReportCycle,
  type WeeklyReportTemplate,
  DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS,
  getWeeklyReportCycleById,
  getWeeklyReportTemplateById,
  listAngelWeeklyReports,
} from "@/lib/weekly-report-store";

type AdminReportCycleDetailPageProps = {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AdminReportCycleDetailData = {
  cycle: WeeklyReportCycle | null;
  template: WeeklyReportTemplate | null;
  teamGroups: TeamMemberGroup[];
  reports: AngelWeeklyReport[];
  shareText: string;
  error: boolean;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function shortDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function safeLoadCycleDetail(
  cycleId: string
): Promise<AdminReportCycleDetailData> {
  try {
    const [cycle, preset] = await Promise.all([
      getWeeklyReportCycleById(cycleId),
      loadMemberPreset(),
    ]);
    const [reports, template] = cycle
      ? await Promise.all([
          listAngelWeeklyReports(cycle.id),
          getWeeklyReportTemplateById(cycle.templateId),
        ])
      : [[], null];
    const shareText = cycle
      ? await buildCycleShareText(cycle.id).catch((error) => {
          console.error("Failed to build weekly report share text", error);
          return "";
        })
      : "";

    return {
      cycle,
      template,
      teamGroups: preset.teamGroups,
      reports,
      shareText,
      error: false,
    };
  } catch (error) {
    console.error("Failed to load admin weekly report cycle detail", error);
    return {
      cycle: null,
      template: null,
      teamGroups: [],
      reports: [],
      shareText: "",
      error: true,
    };
  }
}

function reportValue(
  report: AngelWeeklyReport,
  key: "summary" | "notes" | "requests" | "actionItems"
): string {
  return report[key] ?? "";
}

function CycleDetailPanel({
  cycle,
  template,
  teamGroups,
  reports,
  shareText,
  loadError,
}: {
  cycle: WeeklyReportCycle | null;
  template: WeeklyReportTemplate | null;
  teamGroups: TeamMemberGroup[];
  reports: AngelWeeklyReport[];
  shareText: string;
  loadError: boolean;
}) {
  if (loadError) {
    return (
      <section className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
        데이터를 불러오지 못했습니다. 데이터베이스 연결을 확인해주세요.
      </section>
    );
  }

  if (!cycle) {
    return (
      <section className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
        보고 주차를 찾을 수 없습니다.
      </section>
    );
  }

  const submittedTeamNames = new Set(reports.map((report) => report.teamName));
  const missingTeams = teamGroups.filter((team) => !submittedTeamNames.has(team.teamName));
  const sections = template?.sections ?? DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS;
  const prompt = template?.prompt || cycle.prompt || "팀 분위기, 참여 상황, 도움이 필요한 부분을 자유롭게 적어주세요.";

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/reports"
          className="rounded-full border px-3 py-1 text-sm font-bold"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
        >
          목록
        </Link>
        <Link
          href={`/admin/reports/cycles/${cycle.id}/edit`}
          className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          수정
        </Link>
      </div>

      <article className="card-static p-5 sm:p-7">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              {cycle.title}
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              {cycle.weekLabel}
              {cycle.dueDate ? ` · 마감 ${cycle.dueDate}` : ""}
              {template ? ` · ${template.name}` : " · 템플릿 없음"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--ink-muted)" }}>제출 팀</p>
              <p className="mt-1 text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                {submittedTeamNames.size}/{teamGroups.length}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--ink-muted)" }}>미제출</p>
              <p className="mt-1 text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                {missingTeams.length}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--ink-muted)" }}>보고</p>
              <p className="mt-1 text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                {reports.length}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <OfflineStudyCopyTextButton textToCopy={shareText} />
        </div>

        <p className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-6" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}>
          {prompt}
        </p>
      </article>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3">
          {reports.length === 0 ? (
            <article className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
              제출된 보고가 없습니다.
            </article>
          ) : (
            reports.map((report) => (
              <article key={report.id} className="card-static p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                    {report.teamName}
                  </h3>
                  <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
                    {report.angelName}
                    {shortDateTime(report.updatedAt) ? ` · ${shortDateTime(report.updatedAt)}` : ""}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm">
                  {sections.map((section) => {
                    const value = reportValue(report, section.key);
                    if (!value) return null;
                    return (
                      <div key={section.key} className="rounded-2xl border p-4" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}>
                        <dt className="font-bold" style={{ color: "var(--ink)" }}>
                          {section.title}
                        </dt>
                        <dd className="mt-2 whitespace-pre-wrap leading-6" style={{ color: "var(--ink-muted)" }}>
                          {value}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            ))
          )}
        </div>

        <aside className="card-static p-5">
          <h3 className="text-base font-extrabold" style={{ color: "var(--ink)" }}>
            미제출 팀
          </h3>
          {missingTeams.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              모든 팀이 제출했습니다.
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {missingTeams.map((team) => (
                <div key={team.teamName} className="rounded-2xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                    {team.teamName}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                    엔젤 {team.angels.length > 0 ? team.angels.join(", ") : "미지정"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </section>
  );
}

export default async function AdminReportCycleDetailPage({
  params,
  searchParams,
}: AdminReportCycleDetailPageProps) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [currentRole, routeParams, query] = await Promise.all([
    getCurrentRolePageRole(),
    params,
    searchParams,
  ]);
  const page = getRolePage("admin");
  const access = canOpenRolePage("admin", currentRole, getConfiguredRolePages());

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = (
      <RoleAccessRequired
        role="admin"
        label={page.label}
        invalid={singleParam(query.access) === "invalid"}
      />
    );
  } else {
    const data = await safeLoadCycleDetail(routeParams.cycleId);
    content = (
      <CycleDetailPanel
        cycle={data.cycle}
        template={data.template}
        teamGroups={data.teamGroups}
        reports={data.reports}
        shareText={data.shareText}
        loadError={data.error}
      />
    );
  }

  return (
    <RoleShell
      activeRole="admin"
      title="주간 보고 상세"
      summary="팀별 제출 현황과 보고 내용을 확인합니다."
    >
      {content}
    </RoleShell>
  );
}
