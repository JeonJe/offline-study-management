import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { updateWeeklyReportCycleAction } from "@/app/weekly-report-actions";
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
  type WeeklyReportCycle,
  type WeeklyReportTemplate,
  getWeeklyReportCycleById,
  listWeeklyReportTemplates,
} from "@/lib/weekly-report-store";

const FIELD_CLASS = "h-12 w-full rounded-xl border px-3 text-sm";
const TEXTAREA_CLASS = "min-h-28 w-full rounded-xl border px-3 py-3 text-sm";

type EditCyclePageProps = {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type EditCycleData = {
  cycle: WeeklyReportCycle | null;
  templates: WeeklyReportTemplate[];
  error: boolean;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function safeLoadCycleData(cycleId: string): Promise<EditCycleData> {
  try {
    const [cycle, templates] = await Promise.all([
      getWeeklyReportCycleById(cycleId),
      listWeeklyReportTemplates(),
    ]);

    return {
      cycle,
      templates,
      error: false,
    };
  } catch (error) {
    console.error("Failed to load weekly report cycle edit data", error);
    return {
      cycle: null,
      templates: [],
      error: true,
    };
  }
}

function EditCycleForm({
  cycle,
  templates,
  loadError,
}: {
  cycle: WeeklyReportCycle | null;
  templates: WeeklyReportTemplate[];
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

  return (
    <section className="mx-auto grid max-w-3xl gap-5">
      <div className="card-static p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              보고 주차 수정
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              제목, 기간, 템플릿, 안내 문구를 수정합니다.
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

        <form action={updateWeeklyReportCycleAction} className="mt-6 grid gap-5">
          <input type="hidden" name="cycleId" value={cycle.id} />

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              제목
              <input
                name="title"
                required
                defaultValue={cycle.title}
                className={FIELD_CLASS}
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              주차
              <input
                name="weekLabel"
                required
                defaultValue={cycle.weekLabel}
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
              defaultValue={cycle.templateId ?? ""}
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
                defaultValue={cycle.startDate ?? ""}
                className={FIELD_CLASS}
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              마감일
              <input
                name="dueDate"
                type="date"
                defaultValue={cycle.dueDate ?? ""}
                className={FIELD_CLASS}
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
            안내 문구
            <textarea
              name="prompt"
              rows={4}
              defaultValue={cycle.prompt ?? ""}
              placeholder="비워두면 선택한 템플릿의 작성 기준을 사용합니다."
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
              저장
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default async function EditWeeklyReportCyclePage({
  params,
  searchParams,
}: EditCyclePageProps) {
  const authenticated = await isGlobalAuthenticated();
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
    const data = await safeLoadCycleData(routeParams.cycleId);
    content = (
      <EditCycleForm
        cycle={data.cycle}
        templates={data.templates}
        loadError={data.error}
      />
    );
  }

  return (
    <RoleShell
      activeRole="admin"
      title="보고 주차"
      summary="주간 보고 내용을 수정합니다."
    >
      {content}
    </RoleShell>
  );
}
