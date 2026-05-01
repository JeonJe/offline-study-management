import Link from "next/link";
import { redirect } from "next/navigation";
import {
  updateOperatingUnitAccessCodeAction,
  updateOperatingUnitAction,
} from "@/app/admin/operating-units/operating-unit-actions";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticated } from "@/lib/auth";
import { isOperatingUnitsEnabled } from "@/lib/feature-flags";
import {
  type OperatingUnit,
  getOperatingUnit,
  isProtectedOperatingUnitSlug,
} from "@/lib/operating-unit-store";
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

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
  const protectsActive = isProtectedOperatingUnitSlug(unit.slug);

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

      <div
        className="rounded-xl border px-3 py-3"
        style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
      >
        <label className="flex items-start gap-3 text-sm font-bold" style={{ color: "var(--ink)" }}>
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={unit.isActive || protectsActive}
            disabled={protectsActive}
            className="mt-1"
          />
          <span>
            활성 운영 단위
            <span className="mt-1 block text-xs font-medium leading-5" style={{ color: "var(--ink-muted)" }}>
              비활성 단위는 기존 데이터 조회만 유지하고 신규 등록 대상에서 제외합니다.
              {protectsActive ? " 기본 운영 단위는 비활성화할 수 없습니다." : ""}
            </span>
          </span>
        </label>
        {protectsActive ? <input type="hidden" name="isActive" value="true" /> : null}
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

function AccessCodeForm({
  unit,
  status,
}: {
  unit: OperatingUnit;
  status: string;
}) {
  const statusMessage =
    status === "access-code-updated"
      ? "입장 코드가 변경됐습니다."
      : status === "access-code-required"
        ? "새 입장 코드를 입력하세요."
        : status === "password-invalid"
          ? "관리자 비밀번호가 맞지 않습니다."
          : "";

  return (
    <form
      action={updateOperatingUnitAccessCodeAction}
      className="card-static grid gap-4 p-5 sm:p-6"
    >
      <input type="hidden" name="slug" value={unit.slug} />

      <div className="grid gap-1">
        <h2 className="text-base font-bold" style={{ color: "var(--ink)" }}>
          입장 코드
        </h2>
        <p className="text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
          {unit.hasAccessPassword
            ? "현재 이 운영 단위는 별도 입장 코드를 사용합니다."
            : "아직 별도 입장 코드가 없어 공용 코드로 입장합니다."}
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-bold" htmlFor="accessPassword" style={{ color: "var(--ink)" }}>
          새 입장 코드
        </label>
        <input
          id="accessPassword"
          name="accessPassword"
          type="password"
          required
          minLength={1}
          autoComplete="new-password"
          className="h-11 rounded-xl border px-3 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-bold" htmlFor="accessCodeAdminPassword" style={{ color: "var(--ink)" }}>
          관리자 비밀번호
        </label>
        <input
          id="accessCodeAdminPassword"
          name="adminPassword"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 rounded-xl border px-3 text-sm outline-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
        />
      </div>

      {statusMessage ? (
        <p
          className="rounded-xl border px-3 py-2 text-sm font-semibold"
          style={{
            borderColor: status === "access-code-updated" ? "rgba(21, 128, 61, 0.25)" : "#fecaca",
            backgroundColor: status === "access-code-updated" ? "rgba(21, 128, 61, 0.08)" : "var(--danger-bg)",
            color: status === "access-code-updated" ? "var(--success)" : "var(--danger)",
          }}
        >
          {statusMessage}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          입장 코드 변경
        </button>
      </div>
    </form>
  );
}

export default async function EditOperatingUnitPage({
  params,
  searchParams,
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
  const query = await searchParams;
  const status = singleParam(query.unit);
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
      content = (
        <div className="grid gap-4">
          <EditOperatingUnitForm unit={unit} />
          <AccessCodeForm unit={unit} status={status} />
        </div>
      );
    }
  }

  return (
    <RoleShell
      activeRole="admin"
      title="운영 단위 편집"
      summary="기수 이름, 설명, 입장 코드를 수정합니다."
    >
      {content}
    </RoleShell>
  );
}
