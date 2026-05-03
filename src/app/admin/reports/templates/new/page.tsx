import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { createWeeklyReportTemplateAction } from "@/app/weekly-report-actions";
import { WeeklyReportTemplateForm } from "@/app/admin/reports/templates/new/weekly-report-template-form";
import { isGlobalAuthenticated } from "@/lib/auth";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type NewTemplatePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function TemplateForm({ unitSlug }: { unitSlug: string }) {
  return (
    <section className="mx-auto grid max-w-3xl gap-5">
      <div className="card-static p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              보고 템플릿 만들기
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              보고 화면의 입력 항목과 작성 가이드를 저장합니다.
            </p>
          </div>
          <Link
            href={cohortAwarePath(unitSlug, "/admin/reports")}
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

        <WeeklyReportTemplateForm action={createWeeklyReportTemplateAction} unitSlug={unitSlug} />
      </div>
    </section>
  );
}

export default async function NewWeeklyReportTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
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
    content = <TemplateForm unitSlug={singleParam(query.unit)} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="보고 템플릿"
      summary="주간 보고 작성 기준을 관리합니다."
      unitSlug={singleParam(query.unit)}
    >
      {content}
    </RoleShell>
  );
}
