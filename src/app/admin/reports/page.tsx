import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { deleteWeeklyReportTemplateAction } from "@/app/weekly-report-actions";
import { isGlobalAuthenticated } from "@/lib/auth";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";
import {
  type WeeklyReportTemplate,
  type WeeklyReportCycleWithReports,
  listWeeklyReportTemplates,
  listWeeklyReportOverview,
} from "@/lib/weekly-report-store";

type AdminReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function safeListWeeklyReportOverview(): Promise<{
  cycles: WeeklyReportCycleWithReports[];
  templates: WeeklyReportTemplate[];
  error: boolean;
}> {
  try {
    const [cycles, templates] = await Promise.all([
      listWeeklyReportOverview(),
      listWeeklyReportTemplates(),
    ]);

    return {
      cycles,
      templates,
      error: false,
    };
  } catch (error) {
    console.error("Failed to load weekly report overview", error);
    return {
      cycles: [],
      templates: [],
      error: true,
    };
  }
}

function WeeklyReportAdminPanel({
  cycles,
  templates,
  created,
  updated,
  templateCreated,
  templateUpdated,
  templateDeleted,
  loadError,
}: {
  cycles: WeeklyReportCycleWithReports[];
  templates: WeeklyReportTemplate[];
  created: boolean;
  updated: boolean;
  templateCreated: boolean;
  templateUpdated: boolean;
  templateDeleted: boolean;
  loadError: boolean;
}) {
  return (
    <section id="weekly-reports" className="grid gap-5">
      <section className="card-static p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="mt-2 text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              엔젤 주간 보고
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              보고 주차를 만들고 제출 내용을 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/reports/templates/new"
              className="btn-press rounded-full border px-4 py-2 text-sm font-bold"
              style={{
                borderColor: "rgba(13, 127, 242, 0.25)",
                backgroundColor: "var(--accent-weak)",
                color: "var(--accent-strong)",
              }}
            >
              템플릿 만들기
            </Link>
            <Link
              href="/admin/reports/cycles/new"
              className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: "var(--accent)" }}
            >
              보고 주차 만들기
            </Link>
          </div>
        </div>

        {created || updated || templateCreated || templateUpdated || templateDeleted ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {created ? (
              <span
                className="rounded-full border px-3 py-1 text-sm font-bold"
                style={{
                  borderColor: "var(--success)",
                  backgroundColor: "var(--success-bg)",
                  color: "var(--success)",
                }}
              >
                보고 주차 생성됨
              </span>
            ) : null}
            {updated ? (
              <span
                className="rounded-full border px-3 py-1 text-sm font-bold"
                style={{
                  borderColor: "var(--success)",
                  backgroundColor: "var(--success-bg)",
                  color: "var(--success)",
                }}
              >
                보고 주차 수정됨
              </span>
            ) : null}
            {templateCreated ? (
              <span
                className="rounded-full border px-3 py-1 text-sm font-bold"
                style={{
                  borderColor: "var(--success)",
                  backgroundColor: "var(--success-bg)",
                  color: "var(--success)",
                }}
              >
                템플릿 생성됨
              </span>
            ) : null}
            {templateUpdated ? (
              <span
                className="rounded-full border px-3 py-1 text-sm font-bold"
                style={{
                  borderColor: "var(--success)",
                  backgroundColor: "var(--success-bg)",
                  color: "var(--success)",
                }}
              >
                템플릿 수정됨
              </span>
            ) : null}
            {templateDeleted ? (
              <span
                className="rounded-full border px-3 py-1 text-sm font-bold"
                style={{
                  borderColor: "var(--success)",
                  backgroundColor: "var(--success-bg)",
                  color: "var(--success)",
                }}
              >
                템플릿 삭제됨
              </span>
            ) : null}
          </div>
        ) : null}

        {templates.length > 0 ? (
          <div className="mt-4 grid gap-2">
            <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
              저장된 템플릿
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((template) => (
                <article
                  key={template.id}
                  className="rounded-2xl border bg-white p-3"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                        {template.name}
                      </p>
                      <p className="mt-1 text-xs font-bold" style={{ color: "var(--accent-strong)" }}>
                        입력 항목 {template.sections.length}개
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/reports/templates/${template.id}/edit`}
                        className="rounded-full border px-3 py-1 text-xs font-bold"
                        style={{
                          borderColor: "var(--line)",
                          backgroundColor: "var(--surface)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        수정
                      </Link>
                      <form action={deleteWeeklyReportTemplateAction}>
                        <input type="hidden" name="templateId" value={template.id} />
                        <button
                          type="submit"
                          className="rounded-full border px-3 py-1 text-xs font-bold"
                          style={{
                            borderColor: "#fecaca",
                            backgroundColor: "var(--danger-bg)",
                            color: "var(--danger)",
                          }}
                        >
                          삭제
                        </button>
                      </form>
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: "var(--ink-muted)" }}>
                    {template.prompt}
                  </p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4">
        {loadError ? (
          <div className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
            데이터를 불러오지 못했습니다. 데이터베이스 연결을 확인해주세요.
          </div>
        ) : cycles.length === 0 ? (
          <div className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
            아직 보고 주차가 없습니다.
          </div>
        ) : (
          cycles.map((cycle) => (
            <article key={cycle.id} className="card-static p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                    {cycle.title}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                    {cycle.weekLabel}
                    {cycle.dueDate ? ` · 마감 ${cycle.dueDate}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/reports/cycles/${cycle.id}`}
                    className="btn-press rounded-full px-3 py-1 text-sm font-bold text-white"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    상세
                  </Link>
                  <Link
                    href={`/admin/reports/cycles/${cycle.id}/edit`}
                    className="btn-press rounded-full border px-3 py-1 text-sm font-bold"
                    style={{
                      borderColor: "var(--line)",
                      backgroundColor: "var(--surface)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    수정
                  </Link>
                  <span
                    className="rounded-full border px-3 py-1 text-sm font-bold"
                    style={{
                      borderColor: "rgba(13, 127, 242, 0.25)",
                      backgroundColor: "var(--accent-weak)",
                      color: "var(--accent-strong)",
                    }}
                  >
                    제출 {cycle.reportCount}건
                  </span>
                </div>
              </div>

              <p className="mt-4 line-clamp-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
                {cycle.prompt || "안내 문구 없음"}
              </p>
            </article>
          ))
        )}
      </section>
    </section>
  );
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [currentRole, query] = await Promise.all([
    getCurrentRolePageRole(),
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
    const overview = await safeListWeeklyReportOverview();
    content = (
      <WeeklyReportAdminPanel
        cycles={overview.cycles}
        templates={overview.templates}
        created={singleParam(query.report) === "created"}
        updated={singleParam(query.report) === "updated"}
        templateCreated={singleParam(query.template) === "created"}
        templateUpdated={singleParam(query.template) === "updated"}
        templateDeleted={singleParam(query.template) === "deleted"}
        loadError={overview.error}
      />
    );
  }

  return (
    <RoleShell
      activeRole="admin"
      title="엔젤 주간 보고"
      summary="보고 요청과 제출 내용을 관리합니다."
    >
      {content}
    </RoleShell>
  );
}
