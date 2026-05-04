import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { deleteOperatingUnitAction } from "@/app/admin/operating-units/operating-unit-actions";
import { DeleteOperatingUnitConfirmButton } from "@/app/admin/operating-units/[id]/delete-operating-unit-confirm-button";
import {
  BackToOperatingUnitsLink,
  codeDisplayText,
  OperatingUnitLoadError,
  OperatingUnitNotFound,
  safeGetOperatingUnit,
  singleParam,
} from "@/app/admin/operating-units/operating-unit-page-utils";
import { operatingUnitEditPath } from "@/app/admin/operating-units/operating-unit-routes";
import { RoleShell } from "@/app/role-shell";
import { ToastNotice } from "@/app/toast-notice";
import { isGlobalAuthenticated } from "@/lib/auth";
import { formatReadableDateTime } from "@/lib/date-utils";
import {
  type OperatingUnit,
  isProtectedOperatingUnitSlug,
} from "@/lib/operating-unit-store";

type OperatingUnitDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function detailToastMessage(status: string): { message: string; tone?: "success" | "danger" } | null {
  if (status === "updated") {
    return { message: "수정 완료" };
  }
  if (status === "delete-protected") {
    return { message: "보호된 기수는 삭제할 수 없습니다.", tone: "danger" };
  }
  return null;
}

function CodeValue({
  currentCode,
  hasCode,
}: {
  currentCode: string | null;
  hasCode: boolean;
}) {
  const text = codeDisplayText(currentCode, hasCode);
  if (currentCode) return text;
  return (
    <span style={{ color: "var(--ink-muted)" }}>
      {text}
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t py-3 sm:grid-cols-[140px_1fr]" style={{ borderColor: "var(--line)" }}>
      <dt className="text-sm font-bold" style={{ color: "var(--ink-muted)" }}>
        {label}
      </dt>
      <dd className="text-sm" style={{ color: "var(--ink)" }}>
        {children}
      </dd>
    </div>
  );
}

function DeleteOperatingUnitForm({ unit }: { unit: OperatingUnit }) {
  if (isProtectedOperatingUnitSlug(unit.slug)) {
    return null;
  }

  const formId = `operating-unit-delete-${unit.slug}`;

  return (
    <>
      <form id={formId} action={deleteOperatingUnitAction} className="hidden">
        <input type="hidden" name="slug" value={unit.slug} />
      </form>
      <DeleteOperatingUnitConfirmButton formId={formId} unitName={unit.name} />
    </>
  );
}

function OperatingUnitDetail({ unit }: { unit: OperatingUnit }) {
  return (
    <section className="card-static p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: "var(--ink)" }}>
            {unit.name}
            {unit.isDefault ? (
              <span
                className="ml-2 rounded-full border px-2 py-0.5 align-middle text-[11px] font-bold"
                style={{
                  borderColor: "rgba(13, 127, 242, 0.25)",
                  backgroundColor: "var(--accent-weak)",
                  color: "var(--accent-strong)",
                }}
              >
                기본
              </span>
            ) : null}
          </h2>
          <p className="mt-1 font-mono text-xs" style={{ color: "var(--ink-soft)" }}>
            {unit.slug}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={operatingUnitEditPath(unit.slug)}
            className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: "var(--accent)" }}
          >
            수정
          </Link>
          <DeleteOperatingUnitForm unit={unit} />
        </div>
      </div>

      <dl className="mt-5">
        <DetailRow label="설명">
          {unit.description?.trim() ? unit.description : (
            <span style={{ color: "var(--ink-muted)" }}>미설정</span>
          )}
        </DetailRow>
        <DetailRow label="입장 코드">
          <code className="font-mono text-xs">
            <CodeValue currentCode={unit.accessPassword} hasCode={unit.hasAccessPassword} />
          </code>
        </DetailRow>
        <DetailRow label="엔젤 코드">
          <code className="font-mono text-xs">
            <CodeValue currentCode={unit.angelPassword} hasCode={unit.hasAngelPassword} />
          </code>
        </DetailRow>
        <DetailRow label="관리자 코드">
          <code className="font-mono text-xs">
            <CodeValue currentCode={unit.adminPassword} hasCode={unit.hasAdminPassword} />
          </code>
        </DetailRow>
        <DetailRow label="생성일">{formatReadableDateTime(unit.createdAt)}</DetailRow>
        <DetailRow label="수정일">{formatReadableDateTime(unit.updatedAt)}</DetailRow>
      </dl>
    </section>
  );
}

export default async function OperatingUnitDetailPage({
  params,
  searchParams,
}: OperatingUnitDetailPageProps) {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const routeParams = await params;
  const query = await searchParams;
  const status = singleParam(query.unit);
  const { unit, error } = await safeGetOperatingUnit(routeParams.id);

  let content;
  if (error) {
    content = <OperatingUnitLoadError />;
  } else if (!unit) {
    content = <OperatingUnitNotFound />;
  } else {
    const toast = detailToastMessage(status);
    content = (
      <div className="grid gap-4">
        <BackToOperatingUnitsLink />
        {toast ? <ToastNotice message={toast.message} tone={toast.tone} /> : null}
        <OperatingUnitDetail unit={unit} />
      </div>
    );
  }

  return (
    <RoleShell
      activeRole="admin"
      title="기수 상세"
      summary="기수 이름, 접속 주소, 참가자와 운영진 코드를 확인합니다."
      scopeLabel="전체관리자"
      showRoleNav={false}
    >
      {content}
    </RoleShell>
  );
}
