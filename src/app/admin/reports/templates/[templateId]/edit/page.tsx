import Link from "next/link";
import { redirect } from "next/navigation";
import { WeeklyReportTemplateForm } from "@/app/admin/reports/templates/new/weekly-report-template-form";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { updateWeeklyReportTemplateAction } from "@/app/weekly-report-actions";
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
  getWeeklyReportTemplateById,
} from "@/lib/weekly-report-store";

type EditTemplatePageProps = {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function safeLoadTemplate(
  templateId: string
): Promise<{ template: WeeklyReportTemplate | null; error: boolean }> {
  try {
    return {
      template: await getWeeklyReportTemplateById(templateId),
      error: false,
    };
  } catch (error) {
    console.error("Failed to load weekly report template", error);
    return {
      template: null,
      error: true,
    };
  }
}

function TemplateEditPanel({
  template,
  loadError,
}: {
  template: WeeklyReportTemplate | null;
  loadError: boolean;
}) {
  if (loadError) {
    return (
      <section className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
        템플릿을 불러오지 못했습니다. 데이터베이스 연결을 확인해주세요.
      </section>
    );
  }

  if (!template) {
    return (
      <section className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
        템플릿을 찾을 수 없습니다.
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-3xl gap-5">
      <div className="card-static p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              보고 템플릿 수정
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              입력 항목과 작성 가이드를 수정합니다.
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

        <WeeklyReportTemplateForm
          action={updateWeeklyReportTemplateAction}
          templateId={template.id}
          initialName={template.name}
          initialPrompt={template.prompt}
          initialSections={template.sections.map((section) => ({
            title: section.title,
            prompt: section.prompt,
          }))}
          submitLabel="수정"
        />
      </div>
    </section>
  );
}

export default async function EditWeeklyReportTemplatePage({
  params,
  searchParams,
}: EditTemplatePageProps) {
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
    const data = await safeLoadTemplate(routeParams.templateId);
    content = <TemplateEditPanel template={data.template} loadError={data.error} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="보고 템플릿"
      summary="주간 보고 입력 양식을 관리합니다."
    >
      {content}
    </RoleShell>
  );
}
