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
    const decoded = decodeURIComponent(value);
    return decoded === value ? decoded : decodeTeamName(decoded);
  } catch {
    return value;
  }
}

function formatCommentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function commentAuthorRoleLabel(comment: WeeklyReportComment): string {
  if (comment.authorRole === "admin") return "관리자";
  if (comment.authorRole === "leader") return "방장";
  return "엔젤";
}

function commentInitial(name: string): string {
  return name.trim().slice(0, 1) || "?";
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
  const returnPath = cohortAwarePath(unitSlug, `/angel/reports/${cycle.id}/teams/${team.teamName}`);
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
          <details>
            <summary
              className="btn-press cursor-pointer list-none rounded-full border px-3 py-1 text-sm font-bold"
              style={{
                borderColor: report ? "var(--success)" : "rgba(13, 127, 242, 0.25)",
                backgroundColor: report ? "var(--success-bg)" : "var(--accent-weak)",
                color: report ? "var(--success)" : "var(--accent-strong)",
              }}
            >
              {report ? "수정" : "작성"}
            </summary>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="weekly-report-edit-title"
                className="modal-surface max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto p-5"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 id="weekly-report-edit-title" className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                      {team.teamName} 보고 {report ? "수정" : "작성"}
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                      저장하면 상세 화면의 보고 내용이 갱신됩니다.
                    </p>
                  </div>
                  <span className="rounded-md border px-2 py-1 text-xs font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
                    {team.teamName}
                  </span>
                </div>

                <form action={submitAngelWeeklyReportAction} className="grid gap-4">
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
                          key={`edit-${section.key}-${index}`}
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

                  <div className="flex justify-end gap-2">
                    <Link
                      href={returnPath}
                      className="btn-press inline-flex h-12 items-center rounded-full border px-4 text-sm font-bold"
                      style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
                    >
                      닫기
                    </Link>
                    <button
                      type="submit"
                      className="btn-press h-12 rounded-full px-5 text-sm font-bold text-white"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      저장
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </details>
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

        <section className="mt-4 grid gap-3 md:grid-cols-2">
          {templateSections.map((section, index) => {
            const field = fieldByKey[section.key];
            return (
              <div
                key={`readonly-${section.key}-${index}`}
                className={`rounded-xl border bg-white p-4 ${
                  index === 0 || templateSections.length % 2 === 1 && index === templateSections.length - 1
                    ? "md:col-span-2"
                    : ""
                }`}
                style={{ borderColor: "var(--line)" }}
              >
                <p className="text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
                  {section.title}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ color: field.value ? "var(--ink)" : "var(--ink-muted)" }}>
                  {field.value || "아직 작성된 내용이 없습니다."}
                </p>
              </div>
            );
          })}
        </section>
      </article>

      <section className="card-static grid gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--line)" }}>
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
              댓글
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              보고 내용에 대한 확인 사항을 남깁니다.
            </p>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
            {comments.length}개
          </span>
        </div>

        {!report ? (
          <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            보고 저장 후 댓글을 남길 수 있습니다.
          </p>
        ) : (
          <>
            <div className="rounded-2xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "#f8fbff" }}>
              {comments.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-white px-4 py-8 text-center" style={{ borderColor: "var(--line)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    아직 댓글이 없습니다.
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                    첫 확인 사항을 남겨주세요.
                  </p>
                </div>
              ) : (
                <ol className="grid gap-3">
                  {comments.map((comment) => {
                    const canDelete =
                      currentRole === "admin" ||
                      (currentRole === "angel" &&
                        comment.authorRole === "angel" &&
                        comment.authorLabel === defaultAngelName);
                    const commentDate = formatCommentDate(comment.createdAt);
                    return (
                      <li key={comment.id} className="grid grid-cols-[2.25rem_1fr] gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold"
                          style={{ backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
                          aria-hidden="true"
                        >
                          {commentInitial(comment.authorLabel)}
                        </div>
                        <article className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: "var(--line)" }}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-extrabold" style={{ color: "var(--ink)" }}>
                                  {comment.authorLabel}
                                </p>
                                <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink-muted)" }}>
                                  {commentAuthorRoleLabel(comment)}
                                </span>
                                {commentDate ? (
                                  <time className="text-xs" style={{ color: "var(--ink-muted)" }} dateTime={comment.createdAt}>
                                    {commentDate}
                                  </time>
                                ) : null}
                              </div>
                            </div>
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
                                  className="btn-press rounded-md px-2 py-1 text-xs font-semibold transition hover:bg-red-50"
                                  style={{ color: "var(--danger)" }}
                                >
                                  삭제
                                </button>
                              </form>
                            ) : null}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--ink-soft)" }}>
                            {comment.body}
                          </p>
                        </article>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <form action={addWeeklyReportCommentAction} className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "var(--line)" }}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="authorToken" value={commentAuthorToken ?? ""} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <div>
                <p className="text-sm font-extrabold" style={{ color: "var(--ink)" }}>
                  댓글 작성
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                  이름과 확인 내용을 남겨주세요.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[13rem_1fr]">
                <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }} htmlFor="weekly-report-comment-author">
                  이름
                  <input
                    id="weekly-report-comment-author"
                    name="authorLabel"
                    required
                    maxLength={80}
                    defaultValue={currentRole === "admin" ? "관리자" : defaultAngelName}
                    className="h-11 rounded-xl border px-3 text-sm"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    placeholder="이름"
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }} htmlFor="weekly-report-comment-body">
                  내용
                  <textarea
                    id="weekly-report-comment-body"
                    name="body"
                    required
                    rows={4}
                    maxLength={4000}
                    placeholder="댓글 내용을 입력하세요."
                    className="min-h-28 rounded-xl border px-3 py-3 text-sm"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                </label>
              </div>
              <button
                type="submit"
                className="btn-press justify-self-end rounded-lg px-4 py-2 text-sm font-bold text-white"
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
