import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticated } from "@/lib/auth";
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
  listWeeklyReportCycles,
} from "@/lib/weekly-report-store";

type AngelReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function safeListCycles(): Promise<{
  cycles: WeeklyReportCycle[];
  error: boolean;
}> {
  try {
    return {
      cycles: await listWeeklyReportCycles(),
      error: false,
    };
  } catch (error) {
    console.error("Failed to load angel report cycles", error);
    return {
      cycles: [],
      error: true,
    };
  }
}

function ReportCycleList({
  cycles,
  loadError,
}: {
  cycles: WeeklyReportCycle[];
  loadError: boolean;
}) {
  return (
    <section className="grid gap-4">
      {loadError ? (
        <article className="card-static p-5 sm:p-6">
          <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
            데이터를 불러오지 못했습니다
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
            데이터베이스 연결을 확인한 뒤 다시 시도해주세요.
          </p>
        </article>
      ) : cycles.length === 0 ? (
        <article className="card-static p-5 sm:p-6">
          <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
            열린 보고가 없습니다
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
            관리자가 보고 주차를 만들면 여기에 표시됩니다.
          </p>
        </article>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {cycles.map((cycle) => (
            <Link key={cycle.id} href={`/angel/reports/${cycle.id}`} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                    {cycle.title}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                    {cycle.weekLabel}
                    {cycle.dueDate ? ` · 마감 ${cycle.dueDate}` : ""}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold"
                  style={{
                    borderColor: "rgba(13, 127, 242, 0.25)",
                    backgroundColor: "var(--accent-weak)",
                    color: "var(--accent-strong)",
                  }}
                >
                  제출 {cycle.reportCount}건
                </span>
              </div>
              {cycle.prompt ? (
                <p className="mt-4 line-clamp-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
                  {cycle.prompt}
                </p>
              ) : null}
            </Link>
          ))}
        </section>
      )}
    </section>
  );
}

export default async function AngelReportsPage({ searchParams }: AngelReportsPageProps) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [currentRole, query] = await Promise.all([
    getCurrentRolePageRole(),
    searchParams,
  ]);
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
    const data = await safeListCycles();
    content = <ReportCycleList cycles={data.cycles} loadError={data.error} />;
  }

  return (
    <RoleShell
      activeRole="angel"
      title="주간 보고"
      summary="작성할 주차를 선택합니다."
    >
      {content}
    </RoleShell>
  );
}
