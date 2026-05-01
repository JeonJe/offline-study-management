import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import {
  addWeeklyReportCommentAction,
  deleteWeeklyReportCommentAction,
  submitAngelWeeklyReportAction,
} from "@/app/weekly-report-actions";
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
  createRoleScopedToken,
} from "@/lib/role-session";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  type AngelWeeklyReport,
  type WeeklyReportComment,
  type WeeklyReportCycle,
  type WeeklyReportTemplate,
  DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS,
  getWeeklyReportCycleById,
  getWeeklyReportTemplateById,
  listAngelWeeklyReports,
  listComments,
} from "@/lib/weekly-report-store";
import type { RolePageRole } from "@/lib/role-page";

type AngelTeamReportPageProps = {
  params: Promise<{ cycleId: string; teamName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AngelTeamReportPageData = {
  cycle: WeeklyReportCycle | null;
  template: WeeklyReportTemplate | null;
  team: TeamMemberGroup | null;
  report: AngelWeeklyReport | null;
  comments: WeeklyReportComment[];
  error: boolean;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function decodeTeamName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function loadAngelTeamReportPageData(
  cycleId: string,
  teamName: string
): Promise<AngelTeamReportPageData> {
  try {
    const [cycle, preset] = await Promise.all([
      getWeeklyReportCycleById(cycleId),
      loadMemberPreset(),
    ]);
    const team = preset.teamGroups.find((group) => group.teamName === teamName) ?? null;
    const [reports, template] = cycle
      ? await Promise.all([
          listAngelWeeklyReports(cycle.id),
          getWeeklyReportTemplateById(cycle.templateId),
        ])
      : [[], null];

    const report = reports.find((item) => item.teamName === teamName) ?? null;
    const comments = report ? await listComments(report.id) : [];

    return {
      cycle,
      template,
      team,
      report,
      comments,
      error: false,
    };
  } catch (error) {
    console.error("Failed to load angel team weekly report data", error);
    return {
      cycle: null,
      template: null,
      team: null,
      report: null,
      comments: [],
      error: true,
    };
  }
}

function ReportErrorCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <article className="card-static p-5 sm:p-6">
      <h2 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
        {message}
      </p>
    </article>
  );
}

function TeamReportForm({
  cycle,
  template,
  team,
  report,
  comments,
  currentRole,
  submitted,
  unitSlug,
}: {
  cycle: WeeklyReportCycle;
  template: WeeklyReportTemplate | null;
  team: TeamMemberGroup;
  report: AngelWeeklyReport | null;
  comments: WeeklyReportComment[];
  currentRole: RolePageRole | null;
  submitted: boolean;
  unitSlug: string;
}) {
  const templateText =
    template?.prompt || cycle.prompt || "팀 분위기, 참여 상황, 도움이 필요한 부분을 자유롭게 적어주세요.";
  const templateSections = template?.sections ?? DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS;
  const reportListPath = cohortAwarePath(unitSlug, `/angel/reports/${cycle.id}`);
  const returnPath = cohortAwarePath(unitSlug, `/angel/reports/${cycle.id}/teams/${encodeURIComponent(team.teamName)}`);
  const defaultAngelName =
    report?.angelName && team.angels.includes(report.angelName)
      ? report.angelName
      : team.angels[0] ?? "";
  const commentAuthorToken = report
    ? createRoleScopedToken(
        "angel",
        "weekly-report-comment-author",
        `${report.id}:${defaultAngelName}`
      )
    : null;
  const fieldByKey = {
    summary: {
      name: "summary",
      rows: 7,
      value: report?.summary ?? "",
    },
    notes: {
      name: "notes",
      rows: 4,
      value: report?.notes ?? "",
    },
    requests: {
      name: "requests",
      rows: 4,
      value: report?.requests ?? "",
    },
    actionItems: {
      name: "actionItems",
      rows: 4,
      value: report?.actionItems ?? "",
    },
  } as const;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={reportListPath}
          className="rounded-full border px-3 py-1 text-sm font-bold"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
        >
          팀 목록
        </Link>
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
      </div>

      <article className="card-static p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              {team.teamName} 보고
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              엔젤 {team.angels.length > 0 ? team.angels.join(", ") : "미지정"} · 멤버 {team.members.length}명
            </p>
          </div>
          <span
            className="rounded-full border px-3 py-1 text-sm font-bold"
            style={{
              borderColor: report ? "var(--success)" : "rgba(13, 127, 242, 0.25)",
              backgroundColor: report ? "var(--success-bg)" : "var(--accent-weak)",
              color: report ? "var(--success)" : "var(--accent-strong)",
            }}
          >
            {report ? "수정" : "새 작성"}
          </span>
        </div>

        <div
          className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-6"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
        >
          <span className="font-bold" style={{ color: "var(--ink)" }}>
            이번 주 작성 기준
          </span>
          <span className="ml-2">{templateText}</span>
        </div>
      </article>

      <form action={submitAngelWeeklyReportAction} className="card-static grid gap-4 p-5 sm:p-6">
        <input type="hidden" name="cycleId" value={cycle.id} />
        <input type="hidden" name="teamName" value={team.teamName} />
        <input type="hidden" name="returnPath" value={returnPath} />

        <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
          작성자
          {team.angels.length > 0 ? (
            <select
              name="angelName"
              required
              className="h-12 rounded-xl border px-3 text-sm"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              defaultValue={defaultAngelName}
            >
              {team.angels.map((angel) => (
                <option key={`${team.teamName}-${angel}`} value={angel}>
                  {angel}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="angelName"
              required
              placeholder="작성자 이름"
              defaultValue={report?.angelName ?? ""}
              className="h-12 rounded-xl border px-3 text-sm"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          )}
        </label>

        <section className="grid gap-3 md:grid-cols-2">
          {templateSections.map((section, index) => {
            const field = fieldByKey[section.key];
            return (
              <label
                key={`${section.key}-${index}`}
                className={`grid gap-2 text-sm font-semibold ${
                  index === 0 || templateSections.length % 2 === 1 && index === templateSections.length - 1
                    ? "md:col-span-2"
                    : ""
                }`}
                style={{ color: "var(--ink-soft)" }}
              >
                {section.title}
                <textarea
                  name={field.name}
                  required={section.required}
                  rows={field.rows}
                  placeholder={section.prompt}
                  defaultValue={field.value}
                  className="rounded-xl border px-3 py-3 text-sm"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                />
              </label>
            );
          })}
        </section>

        <button
          type="submit"
          className="btn-press h-12 rounded-full px-4 text-sm font-bold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          저장
        </button>
      </form>

      <section className="card-static grid gap-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
            댓글
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            보고 내용을 확인하며 필요한 피드백을 남깁니다.
          </p>
        </div>

        {!report ? (
          <p className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            보고를 먼저 저장하면 댓글을 남길 수 있습니다.
          </p>
        ) : (
          <>
            <div className="grid gap-3">
              {comments.length === 0 ? (
                <p className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
                  아직 댓글이 없습니다.
                </p>
              ) : (
                comments.map((comment) => {
                  const canDelete =
                    currentRole === "admin" ||
                    (currentRole === "angel" &&
                      comment.authorRole === "angel" &&
                      comment.authorLabel === defaultAngelName);
                  return (
                    <article key={comment.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                          {comment.authorLabel}
                        </p>
                        {canDelete ? (
	                          <form action={deleteWeeklyReportCommentAction}>
	                            <input type="hidden" name="commentId" value={comment.id} />
	                            <input type="hidden" name="reportId" value={report.id} />
	                            <input type="hidden" name="authorLabel" value={defaultAngelName} />
	                            <input
	                              type="hidden"
	                              name="ownershipToken"
	                              value={
	                                createRoleScopedToken(
	                                  "angel",
	                                  "weekly-report-comment-delete",
	                                  `${report.id}:${comment.id}:${defaultAngelName}`
	                                ) ?? ""
	                              }
	                            />
	                            <input type="hidden" name="returnPath" value={returnPath} />
                            <button
                              type="submit"
                              className="btn-press rounded-full border px-2.5 py-1 text-xs font-bold"
                              style={{ borderColor: "#fecaca", color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
                            >
                              삭제
                            </button>
                          </form>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
                        {comment.body}
                      </p>
                    </article>
                  );
                })
              )}
            </div>

            <form action={addWeeklyReportCommentAction} className="grid gap-3">
	              <input type="hidden" name="reportId" value={report.id} />
	              <input type="hidden" name="authorLabel" value={defaultAngelName} />
	              <input type="hidden" name="authorToken" value={commentAuthorToken ?? ""} />
	              <input type="hidden" name="returnPath" value={returnPath} />
              <textarea
                name="body"
                required
                rows={4}
                maxLength={4000}
                placeholder="댓글을 입력하세요."
                className="rounded-xl border px-3 py-3 text-sm"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
              <button
                type="submit"
                className="btn-press h-11 rounded-full px-4 text-sm font-bold text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                댓글 등록
              </button>
            </form>
          </>
        )}
      </section>
    </section>
  );
}

export default async function AngelTeamReportPage({
  params,
  searchParams,
}: AngelTeamReportPageProps) {
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
  const teamName = decodeTeamName(routeParams.teamName);

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
    const data = await loadAngelTeamReportPageData(routeParams.cycleId, teamName);

    if (data.error) {
      content = (
        <ReportErrorCard
          title="데이터를 불러오지 못했습니다"
          message="데이터베이스 연결을 확인한 뒤 다시 시도해주세요."
        />
      );
    } else if (!data.cycle) {
      content = (
        <ReportErrorCard
          title="보고 주차를 찾을 수 없습니다"
          message="주간 보고 목록에서 다시 선택해주세요."
        />
      );
    } else if (!data.team) {
      content = (
        <ReportErrorCard
          title="팀을 찾을 수 없습니다"
          message="팀 목록에서 다시 선택해주세요."
        />
      );
    } else {
      content = (
        <TeamReportForm
          cycle={data.cycle}
          template={data.template}
          team={data.team}
          report={data.report}
          comments={data.comments}
          currentRole={currentRole}
          submitted={singleParam(query.report) === "submitted"}
          unitSlug={unitSlug}
        />
      );
    }
  }

  return (
    <RoleShell
      activeRole="angel"
      title={`${teamName} 주간 보고`}
      summary="보고 내용을 작성합니다."
      unitSlug={unitSlug}
    >
      {content}
    </RoleShell>
  );
}
