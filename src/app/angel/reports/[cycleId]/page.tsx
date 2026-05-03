import Link from "next/link";
import { redirect } from "next/navigation";
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
import {
  type AngelWeeklyReport,
  type WeeklyReportCycle,
  getWeeklyReportCycleById,
  listAngelWeeklyReports,
} from "@/lib/weekly-report-store";
import { cohortAwarePath } from "@/lib/cohort-routes";
import { formatShortDateTime } from "@/lib/date-utils";

type AngelReportCyclePageProps = {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AngelReportPageData = {
  cycle: WeeklyReportCycle | null;
  teamGroups: TeamMemberGroup[];
  reports: AngelWeeklyReport[];
  error: boolean;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function loadAngelReportPageData(
  cycleId: string,
  unitSlug: string
): Promise<AngelReportPageData> {
  try {
    const [cycle, preset] = await Promise.all([
      getWeeklyReportCycleById(cycleId, unitSlug),
      loadMemberPreset(unitSlug),
    ]);

    return {
      cycle,
      teamGroups: preset.teamGroups,
      reports: cycle ? await listAngelWeeklyReports(cycle.id, unitSlug) : [],
      error: false,
    };
  } catch (error) {
    console.error("Failed to load angel weekly report data", error);
    return {
      cycle: null,
      teamGroups: [],
      reports: [],
      error: true,
    };
  }
}

function reportsForTeam(
  reports: AngelWeeklyReport[],
  teamName: string
): AngelWeeklyReport[] {
  return reports.filter((report) => report.teamName === teamName);
}

function shortDateTime(value: string): string {
  return formatShortDateTime(value);
}

function TeamReportCard({
  cycle,
  team,
  reports,
  unitSlug,
}: {
  cycle: WeeklyReportCycle;
  team: TeamMemberGroup;
  reports: AngelWeeklyReport[];
  unitSlug: string;
}) {
  const submitted = reports.length > 0;
  const latestReport = reports[0];
  const submittedAt = latestReport ? shortDateTime(latestReport.updatedAt) : "";
  const teamReportPath = cohortAwarePath(
    unitSlug,
    `/angel/reports/${cycle.id}/teams/${team.teamName}`
  );

  return (
    <Link
      href={teamReportPath}
      className="card group block cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
            {team.teamName}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            엔젤 {team.angels.length > 0 ? team.angels.join(", ") : "미지정"} · 멤버 {team.members.length}명
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: submitted ? "var(--success)" : "var(--accent-strong)" }}>
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: submitted ? "var(--success)" : "var(--accent)" }}
              aria-hidden="true"
            />
            {submitted ? "제출됨" : "미작성"}
          </span>
          <span className="rounded-full border px-3 py-1 text-xs font-bold transition group-hover:border-transparent" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}>
            {submitted ? "수정하기" : "작성하기"}
          </span>
        </div>
      </div>

      {submitted ? (
        <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold" style={{ color: "var(--ink-muted)" }}>
              최근 작성 내용
            </p>
            <p className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
              {latestReport.angelName}
              {submittedAt ? ` · ${submittedAt}` : ""}
            </p>
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: "var(--ink-soft)" }}>
            {latestReport.summary}
          </p>
        </div>
      ) : null}
    </Link>
  );
}

function WeeklyReportAngelPanel({
  cycle,
  teamGroups,
  reports,
  submitted,
  loadError,
  unitSlug,
}: {
  cycle: WeeklyReportCycle | null;
  teamGroups: TeamMemberGroup[];
  reports: AngelWeeklyReport[];
  submitted: boolean;
  loadError: boolean;
  unitSlug: string;
}) {
  const submittedTeamCount = teamGroups.filter((team) =>
    reports.some((report) => report.teamName === team.teamName)
  ).length;

  return (
    <section id="weekly-report" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
            주간 보고
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {submitted ? (
            <span
              className="rounded-full border px-3 py-1 text-sm font-bold"
              style={{
                borderColor: "var(--success)",
                backgroundColor: "var(--success-bg)",
                color: "var(--success)",
              }}
            >
              저장됨
            </span>
          ) : null}
          <Link
            href={cohortAwarePath(unitSlug, "/angel/reports")}
            className="rounded-full border px-3 py-1 text-sm font-bold"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
          >
            주차 목록
          </Link>
        </div>
      </div>

      {loadError ? (
        <article className="card-static p-5 sm:p-6">
          <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
            데이터를 불러오지 못했습니다
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
            데이터베이스 연결을 확인한 뒤 다시 시도해주세요.
          </p>
        </article>
      ) : !cycle ? (
        <article className="card-static p-5 sm:p-6">
          <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
            보고 주차를 찾을 수 없습니다
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
            주간 보고 목록에서 다시 선택해주세요.
          </p>
        </article>
      ) : (
        <>
          <article className="card-static p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div>
                <h3 className="text-xl font-extrabold" style={{ color: "var(--ink)" }}>
                  {cycle.title}
                </h3>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                  {cycle.weekLabel}
                  {cycle.dueDate ? ` · 마감 ${cycle.dueDate}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
                  <p className="text-xs font-bold" style={{ color: "var(--ink-muted)" }}>
                    작성 팀
                  </p>
                  <p className="mt-1 text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                    {submittedTeamCount}/{teamGroups.length}
                  </p>
                </div>
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
                  <p className="text-xs font-bold" style={{ color: "var(--ink-muted)" }}>
                    작성 건
                  </p>
                  <p className="mt-1 text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                    {cycle.reportCount}
                  </p>
                </div>
              </div>
            </div>
            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-6"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
            >
              <span className="font-bold" style={{ color: "var(--ink)" }}>
                이번 주 작성 기준
              </span>
              <span className="ml-2">
                {cycle.prompt || "팀 분위기, 참여 상황, 도움이 필요한 부분을 자유롭게 적어주세요."}
              </span>
            </div>
          </article>

          <section className="grid items-start gap-4 md:grid-cols-2">
            {teamGroups.length === 0 ? (
              <article className="card-static p-5 sm:p-6 md:col-span-2">
                <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                  등록된 팀이 없습니다
                </h3>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
                  관리자 페이지에서 팀과 엔젤을 먼저 등록해주세요.
                </p>
              </article>
            ) : (
              teamGroups.map((team) => (
                <TeamReportCard
                  key={team.teamName}
                  cycle={cycle}
                  team={team}
                  reports={reportsForTeam(reports, team.teamName)}
                  unitSlug={unitSlug}
                />
              ))
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default async function AngelReportCyclePage({
  params,
  searchParams,
}: AngelReportCyclePageProps) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
  const unitSlug = singleParam(query.unit);
  if (!unitSlug) {
    redirect("/admin");
  }

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const currentRole = await getCurrentRolePageRole();
  const page = getRolePage("angel");
  const access = canOpenRolePage("angel", currentRole, getConfiguredRolePages());

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = (
      <RoleAccessRequired
        role="angel"
        label={page.label}
        invalid={singleParam(query.access) === "invalid"}
      />
    );
  } else {
    const unitSlug = singleParam(query.unit);
    const data = await loadAngelReportPageData(routeParams.cycleId, unitSlug);

    content = (
      <WeeklyReportAngelPanel
        cycle={data.cycle}
        teamGroups={data.teamGroups}
        reports={data.reports}
        submitted={singleParam(query.report) === "submitted"}
        loadError={data.error}
        unitSlug={unitSlug}
      />
    );
  }

  return (
    <RoleShell
      activeRole="angel"
      title="주간 보고 작성"
      summary="선택한 주차의 팀별 보고를 작성합니다."
      unitSlug={unitSlug}
    >
      {content}
    </RoleShell>
  );
}
