import Link from "next/link";
import { redirect } from "next/navigation";
import { updateOperatingUnitAction } from "@/app/admin/operating-units/operating-unit-actions";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticated } from "@/lib/auth";
import { isOperatingUnitsEnabled } from "@/lib/feature-flags";
import { type OperatingUnit, getOperatingUnit } from "@/lib/operating-unit-store";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type EditOperatingUnitPageProps = {
  params: Promise<{ id: string }>;
};

async function safeGetOperatingUnit(slug: string): Promise<{
  unit: OperatingUnit | null;
  error: boolean;
}> {
  try {
    return { unit: await getOperatingUnit(slug), error: false };
  } catch (error) {
    console.error("[operating-units] getOperatingUnit 실패:", error);
    return { unit: null, error: true };
  }
}

function EditOperatingUnitForm({ unit }: { unit: OperatingUnit }) {
  return (
    <form action={updateOperatingUnitAction} className="card-static grid gap-4 p-5 sm:p-6">
      <input type="hidden" name="slug" value={unit.slug} />

      <div className="grid gap-2">
        <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>
          슬러그
        </span>
        <code
          className="rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
        >
          {unit.slug}
        </code>
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
          저장
        </button>
      </div>
    </form>
  );
}

export default async function EditOperatingUnitPage({
  params,
}: EditOperatingUnitPageProps) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  if (!isOperatingUnitsEnabled()) {
    redirect("/admin");
  }

  const [currentRole, routeParams] = await Promise.all([
    getCurrentRolePageRole(),
    params,
  ]);
  const page = getRolePage("admin");
  const access = canOpenRolePage("admin", currentRole, getConfiguredRolePages());

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = <RoleAccessRequired role="admin" label={page.label} invalid={false} />;
  } else {
    const { unit, error } = await safeGetOperatingUnit(routeParams.id);
    if (error) {
      content = (
        <section className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
          데이터를 불러오지 못했습니다.
        </section>
      );
    } else if (!unit) {
      content = (
        <section className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
          운영 단위를 찾을 수 없습니다.
        </section>
      );
    } else {
      content = <EditOperatingUnitForm unit={unit} />;
    }
  }

  return (
    <RoleShell
      activeRole="admin"
      title="운영 단위 편집"
      summary="기수 이름과 설명을 수정합니다."
    >
      {content}
    </RoleShell>
  );
}
