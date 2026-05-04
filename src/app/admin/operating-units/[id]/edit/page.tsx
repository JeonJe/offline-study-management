import Link from "next/link";
import { redirect } from "next/navigation";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import {
  BackToOperatingUnitDetailLink,
  codeDisplayText,
  OperatingUnitLoadError,
  OperatingUnitNotFound,
  safeGetOperatingUnit,
  singleParam,
} from "@/app/admin/operating-units/operating-unit-page-utils";
import { operatingUnitDetailPath } from "@/app/admin/operating-units/operating-unit-routes";
import {
  updateOperatingUnitAccessCodeAction,
  updateOperatingUnitAdminCodeAction,
  updateOperatingUnitAngelCodeAction,
  updateOperatingUnitAction,
} from "@/app/admin/operating-units/operating-unit-actions";
import { RoleShell } from "@/app/role-shell";
import { ToastNotice } from "@/app/toast-notice";
import { isGlobalAuthenticated } from "@/lib/auth";
import { type OperatingUnit } from "@/lib/operating-unit-store";

type EditOperatingUnitPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function EditOperatingUnitForm({ unit }: { unit: OperatingUnit }) {
  return (
    <form action={updateOperatingUnitAction} className="card-static grid gap-4 p-5 sm:p-6">
      <input type="hidden" name="slug" value={unit.slug} />

      <div className="grid gap-2">
        <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>
          접속 주소
        </span>
        <code
          className="rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
        >
          {unit.slug}
        </code>
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          링크에 쓰이는 값입니다. 예: /cohorts/{unit.slug}/admin
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-bold" htmlFor="name" style={{ color: "var(--ink)" }}>
          이름
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={unit.name}
          className="h-11 rounded-xl border px-3 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-bold" htmlFor="description" style={{ color: "var(--ink)" }}>
          설명
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={unit.description ?? ""}
          placeholder="예: 2026년 상반기 루프팩 오프라인 수업"
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={operatingUnitDetailPath(unit.slug)}
          className="rounded-full border px-4 py-2 text-sm font-bold"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
        >
          취소
        </Link>
        <PendingSubmitButton
          idleLabel="저장"
          pendingLabel="저장 중"
          className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
          style={{ backgroundColor: "var(--accent)" }}
        />
      </div>
    </form>
  );
}

function CodeFormRow({
  unit,
  label,
  fieldName,
  currentCode,
  hasCode,
  placeholder,
  action,
}: {
  unit: OperatingUnit;
  label: string;
  fieldName: string;
  currentCode: string | null;
  hasCode: boolean;
  placeholder: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      className="grid gap-3 border-t py-4 lg:grid-cols-[140px_1fr_1fr_auto] lg:items-center"
      style={{ borderColor: "var(--line)" }}
    >
      <input type="hidden" name="slug" value={unit.slug} />
      <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>
        {label}
      </div>
      <input
        value={codeDisplayText(currentCode, hasCode)}
        readOnly
        aria-label={`${label} 현재 코드`}
        className="h-10 rounded-xl border px-3 text-sm outline-none"
        style={{
          borderColor: "var(--line)",
          backgroundColor: "var(--surface-alt)",
          color: currentCode ? "var(--ink)" : "var(--ink-muted)",
        }}
      />
      <input
        name={fieldName}
        type="password"
        required
        minLength={1}
        autoComplete="new-password"
        placeholder={placeholder}
        aria-label={`${label} 새 코드`}
        className="h-10 rounded-xl border px-3 text-sm outline-none"
        style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
      />
      <PendingSubmitButton
        idleLabel="변경"
        pendingLabel="변경 중"
        className="btn-press h-10 rounded-full px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
        style={{ backgroundColor: "var(--accent)" }}
      />
    </form>
  );
}

function CodeManagementPanel({ unit }: { unit: OperatingUnit }) {
  return (
    <section className="card-static p-5 sm:p-6">
      <h2 className="text-base font-bold" style={{ color: "var(--ink)" }}>
        코드 관리
      </h2>
      <div className="mt-2 text-xs leading-5" style={{ color: "var(--ink-muted)" }}>
        새 코드로 변경하면 기존 코드는 더 이상 사용할 수 없습니다.
      </div>
      <div className="mt-3">
        <CodeFormRow
          unit={unit}
          label="입장 코드"
          fieldName="accessPassword"
          currentCode={unit.accessPassword}
          hasCode={unit.hasAccessPassword}
          placeholder="참가자가 입력할 코드"
          action={updateOperatingUnitAccessCodeAction}
        />
        <CodeFormRow
          unit={unit}
          label="엔젤 코드"
          fieldName="angelPassword"
          currentCode={unit.angelPassword}
          hasCode={unit.hasAngelPassword}
          placeholder="엔젤 화면 코드"
          action={updateOperatingUnitAngelCodeAction}
        />
        <CodeFormRow
          unit={unit}
          label="관리자 코드"
          fieldName="adminPassword"
          currentCode={unit.adminPassword}
          hasCode={unit.hasAdminPassword}
          placeholder="관리자 화면 코드"
          action={updateOperatingUnitAdminCodeAction}
        />
      </div>
    </section>
  );
}

function editToastMessage(status: string): { message: string; tone?: "success" | "danger" } | null {
  if (status === "access-code-updated") {
    return { message: "변경 완료" };
  }
  if (status === "access-code-required") {
    return { message: "새 입장 코드를 입력하세요.", tone: "danger" };
  }
  if (status === "angel-code-updated") {
    return { message: "변경 완료" };
  }
  if (status === "angel-code-required") {
    return { message: "새 엔젤 코드를 입력하세요.", tone: "danger" };
  }
  if (status === "admin-code-updated") {
    return { message: "변경 완료" };
  }
  if (status === "admin-code-required") {
    return { message: "새 관리자 코드를 입력하세요.", tone: "danger" };
  }
  return null;
}

export default async function EditOperatingUnitPage({
  params,
  searchParams,
}: EditOperatingUnitPageProps) {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const routeParams = await params;
  const query = await searchParams;
  const status = singleParam(query.unit);

  let content;
  const { unit, error } = await safeGetOperatingUnit(routeParams.id);
  if (error) {
    content = <OperatingUnitLoadError />;
  } else if (!unit) {
    content = <OperatingUnitNotFound />;
  } else {
    const toast = editToastMessage(status);
    content = (
      <div className="grid gap-4">
        <BackToOperatingUnitDetailLink unit={unit} />
        {toast ? <ToastNotice message={toast.message} tone={toast.tone} /> : null}
        <EditOperatingUnitForm unit={unit} />
        <CodeManagementPanel unit={unit} />
      </div>
    );
  }

  return (
    <RoleShell
      activeRole="admin"
      title="기수 편집"
      summary="기수 이름, 설명, 참가자와 운영진 코드를 수정합니다."
      scopeLabel="전체관리자"
      showRoleNav={false}
    >
      {content}
    </RoleShell>
  );
}
