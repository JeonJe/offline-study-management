import Link from "next/link";
import { redirect } from "next/navigation";
import { createOperatingUnitAction } from "@/app/admin/operating-units/operating-unit-actions";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticated } from "@/lib/auth";
import { isOperatingUnitsEnabled } from "@/lib/feature-flags";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

function OperatingUnitForm() {
  return (
    <form action={createOperatingUnitAction} className="card-static grid gap-4 p-5 sm:p-6">
      <div className="grid gap-2">
        <label className="text-sm font-bold" htmlFor="slug" style={{ color: "var(--ink)" }}>
          슬러그
        </label>
        <input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9_-]+"
          placeholder="cohort-4"
          className="h-11 rounded-xl border px-3 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          영문 소문자, 숫자, 하이픈, 언더스코어만 사용합니다.
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
          placeholder="4기"
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
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-bold" htmlFor="adminPassword" style={{ color: "var(--ink)" }}>
          관리자 비밀번호
        </label>
        <input
          id="adminPassword"
          name="adminPassword"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 rounded-xl border px-3 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
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

export default async function NewOperatingUnitPage() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  if (!isOperatingUnitsEnabled()) {
    redirect("/admin");
  }

  const currentRole = await getCurrentRolePageRole();
  const page = getRolePage("admin");
  const access = canOpenRolePage("admin", currentRole, getConfiguredRolePages());

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = <RoleAccessRequired role="admin" label={page.label} invalid={false} />;
  } else {
    content = <OperatingUnitForm />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="운영 단위 생성"
      summary="기수 식별자와 표시 이름을 등록합니다."
    >
      {content}
    </RoleShell>
  );
}
