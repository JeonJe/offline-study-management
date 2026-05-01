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
              기본
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
              </td>
              <td className="px-5 py-3">
                {unit.isDefault ? (
                  <span
                    className="rounded-full border px-2.5 py-1 text-xs font-bold"
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
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function OperatingUnitsPage() {
  const authenticated = await isAuthenticated();
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
      summary="운영 단위(기수) 목록을 확인합니다."
    >
      {content}
    </RoleShell>
  );
}
