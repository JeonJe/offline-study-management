import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  type RolePageRole,
  listRolePages,
} from "@/lib/role-page";
import { DEFAULT_OPERATING_UNIT_NAME } from "@/lib/operating-unit-store";

type RoleShellProps = {
  activeRole: RolePageRole;
  title: string;
  summary: string;
  unitSlug?: string;
  scopeLabel?: string;
  showRoleNav?: boolean;
  children: ReactNode;
};

const navStyle = {
  borderColor: "var(--line)",
  backgroundColor: "var(--surface)",
  color: "var(--ink-soft)",
};

const activeNavStyle = {
  borderColor: "rgba(13, 127, 242, 0.35)",
  backgroundColor: "var(--accent-weak)",
  color: "var(--accent-strong)",
};

export function RoleShell({
  activeRole,
  title,
  summary,
  unitSlug = "",
  scopeLabel,
  showRoleNav = true,
  children,
}: RoleShellProps) {
  const displayScope = scopeLabel ?? DEFAULT_OPERATING_UNIT_NAME;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
      <header
        className="fixed inset-x-0 top-0 z-40 border-b px-4 py-2.5 sm:px-6 lg:px-8"
        style={{
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(255, 255, 255, 0.96)",
          borderColor: "var(--line)",
        }}
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="truncate text-xl font-extrabold tracking-tight sm:text-2xl"
                style={{ fontFamily: "var(--font-heading), sans-serif", color: "var(--ink)" }}
              >
                {title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--ink-soft)" }}
                aria-label={`현재 항목 ${displayScope}`}
              >
                {displayScope}
              </span>
              {showRoleNav ? (
                <nav className="flex flex-wrap items-center gap-2" aria-label="역할별 페이지 이동">
                  {listRolePages().map((page) => (
                    <Link
                      key={page.role}
                      href={cohortAwarePath(unitSlug, page.path)}
                      aria-current={activeRole === page.role ? "page" : undefined}
                      className="btn-press rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-85"
                      style={activeRole === page.role ? activeNavStyle : navStyle}
                    >
                      {page.label}
                    </Link>
                  ))}
                </nav>
              ) : null}

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="btn-press rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                  style={{
                    borderColor: "#fecaca",
                    color: "var(--danger)",
                    backgroundColor: "var(--danger-bg)",
                  }}
                >
                  로그아웃
                </button>
              </form>
            </div>
          </div>

          <p className="mt-1.5 max-w-3xl text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
            {summary}
          </p>
        </div>
      </header>
      <div className="h-[118px] sm:h-[76px]" aria-hidden="true" />

      {children}
    </main>
  );
}
