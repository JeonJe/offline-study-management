import { redirect } from "next/navigation";
import Link from "next/link";
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
import { type OperatingUnit, listOperatingUnits } from "@/lib/operating-unit-store";

async function safeListOperatingUnits(): Promise<{ units: OperatingUnit[]; error: boolean }> {
  try {
    const units = await listOperatingUnits();
    return { units, error: false };
  } catch (err) {
    console.error("[operating-units] listOperatingUnits 실패:", err);
    return { units: [], error: true };
  }
}

function OperatingUnitsPanel({
  units,
  error,
}: {
  units: OperatingUnit[];
  error: boolean;
}) {
  if (error) {
    return (
      <div className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
        데이터를 불러오지 못했습니다.
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
        운영 단위가 없습니다.
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: "var(--ink)" }}>
            전체 기수
          </h2>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
            생성, 비활성화, 입장 코드 변경은 각 기수의 편집 화면에서 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/operating-units/new"
          className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          새 기수 만들기
        </Link>
      </div>

      <section className="card-static overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <th
                className="px-5 py-3 text-left font-bold"
                style={{ color: "var(--ink-muted)" }}
              >
                슬러그
              </th>
              <th
                className="px-5 py-3 text-left font-bold"
                style={{ color: "var(--ink-muted)" }}
              >
                이름
              </th>
              <th
                className="px-5 py-3 text-left font-bold"
                style={{ color: "var(--ink-muted)" }}
              >
                입장 코드
              </th>
              <th
                className="px-5 py-3 text-left font-bold"
                style={{ color: "var(--ink-muted)" }}
              >
                상태
              </th>
              <th className="px-5 py-3 text-right font-bold" style={{ color: "var(--ink-muted)" }}>
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr
                key={unit.slug}
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <td
                  className="px-5 py-3 font-mono text-xs"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {unit.slug}
                </td>
                <td className="px-5 py-3 font-bold" style={{ color: "var(--ink)" }}>
                  {unit.name}
                  {unit.isDefault ? (
                    <span
                      className="ml-2 rounded-full border px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        borderColor: "rgba(13, 127, 242, 0.25)",
                        backgroundColor: "var(--accent-weak)",
                        color: "var(--accent-strong)",
                      }}
                    >
                      기본
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-3">
                  <span
                    className="rounded-full border px-2.5 py-1 text-xs font-bold"
                    style={{
                      borderColor: unit.hasAccessPassword ? "rgba(21, 128, 61, 0.25)" : "var(--line)",
                      backgroundColor: unit.hasAccessPassword ? "rgba(21, 128, 61, 0.08)" : "var(--surface-alt)",
                      color: unit.hasAccessPassword ? "var(--success)" : "var(--ink-muted)",
                    }}
                  >
                    {unit.hasAccessPassword ? "설정됨" : "공용 코드"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className="rounded-full border px-2.5 py-1 text-xs font-bold"
                    style={{
                      borderColor: unit.isActive ? "rgba(21, 128, 61, 0.25)" : "#fecaca",
                      backgroundColor: unit.isActive ? "rgba(21, 128, 61, 0.08)" : "var(--danger-bg)",
                      color: unit.isActive ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {unit.isActive ? "활성" : "비활성"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/operating-units/${encodeURIComponent(unit.slug)}/edit`}
                    className="rounded-full border px-3 py-1.5 text-xs font-bold"
                    style={{ borderColor: "var(--line)", color: "var(--accent)" }}
                  >
                    편집
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

export default async function OperatingUnitsPage() {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const currentRole = await getCurrentRolePageRole();
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
        invalid={false}
      />
    );
  } else {
    const { units, error } = await safeListOperatingUnits();
    content = <OperatingUnitsPanel units={units} error={error} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="기수 관리"
      summary="전체 기수의 생성, 상태, 입장 코드를 관리합니다."
      scopeLabel="전체 관리자"
      showRoleNav={false}
    >
      {content}
    </RoleShell>
  );
}
