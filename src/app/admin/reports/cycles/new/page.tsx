import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { createWeeklyReportCycleAction } from "@/app/weekly-report-actions";
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
  listWeeklyReportTemplates,
} from "@/lib/weekly-report-store";

const FIELD_CLASS = "h-12 w-full rounded-xl border px-3 text-sm";
const TEXTAREA_CLASS = "min-h-28 w-full rounded-xl border px-3 py-3 text-sm";

type NewCyclePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function safeListTemplates(): Promise<{
  templates: WeeklyReportTemplate[];
  error: boolean;
}> {
  try {
    return {
      templates: await listWeeklyReportTemplates(),
      error: false,
    };
  } catch (error) {
    console.error("Failed to load weekly report templates", error);
    return {
      templates: [],
      error: true,
    };
  }
}

function CycleForm({
  templates,
  loadError,
}: {
  templates: WeeklyReportTemplate[];
  loadError: boolean;
}) {
  return (
    <section className="mx-auto grid max-w-3xl gap-5">
      <div className="card-static p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              보고 주차 만들기
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              엔젤이 작성할 주간 보고를 엽니다.
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="btn-press rounded-full border px-4 py-2 text-sm font-bold"
            style={{
              borderColor: "var(--line)",
              backgroundColor: "var(--surface)",
              color: "var(--ink-soft)",
            }}
          >
            목록으로
          </Link>
        </div>

        {loadError ? (
          <div className="mt-5 rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            템플릿을 불러오지 못했습니다. 템플릿 없이 주차를 만들 수 있습니다.
          </div>
        ) : null}

        <form action={createWeeklyReportCycleAction} className="mt-6 grid gap-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              제목
              <input
                name="title"
                required
                placeholder="4기 3주차 엔젤 보고"
                className={FIELD_CLASS}
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              주차
              <input
                name="weekLabel"
                required
                placeholder="3주차"
                className={FIELD_CLASS}
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
            사용할 템플릿
            <select
              name="templateId"
              className={FIELD_CLASS}
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              defaultValue=""
            >
              <option value="">선택 안 함</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              시작일
              <input
                name="startDate"
                type="date"
                className={FIELD_CLASS}
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              마감일
              <input
                name="dueDate"
                type="date"
                className={FIELD_CLASS}
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
            안내 문구
            <textarea
              name="prompt"
              placeholder="비워두면 선택한 템플릿의 작성 기준을 사용합니다."
              rows={4}
              className={TEXTAREA_CLASS}
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-press h-12 min-w-32 rounded-full px-6 text-sm font-bold text-white"
              style={{ backgroundColor: "var(--accent)" }}
            >
              생성
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default async function NewWeeklyReportCyclePage({
  searchParams,
}: NewCyclePageProps) {
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
    const { templates, error } = await safeListTemplates();
    content = <CycleForm templates={templates} loadError={error} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="보고 주차"
      summary="주차별 엔젤 보고를 생성합니다."
    >
      {content}
    </RoleShell>
  );
}
