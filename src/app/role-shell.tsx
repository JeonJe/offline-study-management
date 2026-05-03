import type { ReactNode } from "react";
import { DashboardHeader, type DashboardTab } from "@/app/dashboard-header";
import type { RolePageRole } from "@/lib/role-page";

type RoleShellProps = {
  activeRole: RolePageRole;
  title: string;
  summary: string;
  unitSlug?: string;
  scopeLabel?: string;
  showRoleNav?: boolean;
  children: ReactNode;
};

const ROLE_DASHBOARD_TAB: Record<RolePageRole, DashboardTab> = {
  member: "study",
  angel: "angel",
  admin: "admin",
};

export function RoleShell({
  activeRole,
  title,
  unitSlug = "",
  scopeLabel,
  children,
}: RoleShellProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
      <DashboardHeader
        title={title}
        activeTab={ROLE_DASHBOARD_TAB[activeRole]}
        unitSlug={unitSlug}
        scopeLabel={scopeLabel}
      />

      {children}
    </main>
  );
}
