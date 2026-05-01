import Link from "next/link";
import { redirect } from "next/navigation";
import { createOperatingUnitAction } from "@/app/admin/operating-units/operating-unit-actions";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isGlobalAuthenticated } from "@/lib/auth";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

function OperatingUnitForm({ unitStatus }: { unitStatus?: string }) {
  const message =
    unitStatus === "access-code-required" ? "입장 코드를 입력하세요." : "";

  return (
    <form action={createOperatingUnitAction} className="card-static grid gap-4 p-5 sm:p-6">
      {message ? (
        <div
          className="rounded-xl border px-3 py-2 text-sm font-semibold"
          style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" }}
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm font-bold" htmlFor="slug" style={{ color: "var(--ink)" }}>
          주소 식별자
        </label>
        <input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9_-]+"
          placeholder="예: loop-pak-4"
          className="h-11 rounded-xl border px-3 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          주소에 들어갈 짧은 값입니다. 예: /cohorts/loop-pak-4/admin
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
          placeholder="예: 루프팩 4기"
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
          placeholder="예: 2026년 상반기 루프팩 오프라인 수업"
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-bold" htmlFor="accessPassword" style={{ color: "var(--ink)" }}>
          입장 코드
        </label>
        <input
          id="accessPassword"
          name="accessPassword"
          type="password"
          required
          autoComplete="new-password"
          placeholder="참가자가 첫 화면에서 입력할 코드"
          className="h-11 rounded-xl border px-3 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          참가자는 첫 화면에서 이름을 고른 뒤 이 코드로 입장합니다.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href="/admin/operating-units"
          className="rounded-full border px-4 py-2 text-sm font-bold"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
        >
          취소
        </Link>
        <button
          type="submit"
          className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          생성
        </button>
      </div>
    </form>
  );
}

export default async function NewOperatingUnitPage({
  searchParams,
}: {
  searchParams?: Promise<{ unit?: string }>;
}) {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const unitStatus = (await searchParams)?.unit;
  const currentRole = await getCurrentRolePageRole();
  const page = getRolePage("admin");
  const access = canOpenRolePage("admin", currentRole, getConfiguredRolePages());

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = <RoleAccessRequired role="admin" label={page.label} invalid={false} />;
  } else {
    content = <OperatingUnitForm unitStatus={unitStatus} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="새 항목 만들기"
      summary="주소, 이름, 입장 코드를 등록합니다."
      scopeLabel="전체 관리자"
      showRoleNav={false}
    >
      {content}
    </RoleShell>
  );
}
