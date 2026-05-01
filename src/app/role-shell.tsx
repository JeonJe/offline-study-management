import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions";
import {
  type RolePageRole,
  listRolePages,
} from "@/lib/role-page";
import { DEFAULT_OPERATING_UNIT_NAME } from "@/lib/operating-unit-store";

type RoleShellProps = {
  activeRole: RolePageRole;
  title: string;
  summary: string;
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
  children,
}: RoleShellProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
      <header
        className="sticky top-0 z-30 mb-5 w-screen border-b px-4 py-4 sm:px-6 lg:px-8 fade-in"
        style={{
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(255, 255, 255, 0.94)",
          borderColor: "var(--line)",
          marginLeft: "calc(50% - 50vw)",
        }}
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="truncate text-2xl font-extrabold tracking-tight sm:text-[2rem]"
                style={{ fontFamily: "var(--font-heading), sans-serif", color: "var(--ink)" }}
              >
                {title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full border px-3.5 py-2 text-sm font-bold"
                style={{
                  borderColor: "rgba(13, 127, 242, 0.25)",
                  backgroundColor: "var(--accent-weak)",
                  color: "var(--accent-strong)",
                }}
              >
                {DEFAULT_OPERATING_UNIT_NAME}
              </span>
              <nav className="flex flex-wrap items-center gap-2" aria-label="역할별 페이지 이동">
                {listRolePages().map((page) => (
                  <Link
                    key={page.role}
                    href={page.path}
                    aria-current={activeRole === page.role ? "page" : undefined}
                    className="btn-press rounded-full border px-3.5 py-2 text-sm font-semibold transition hover:opacity-85"
                    style={activeRole === page.role ? activeNavStyle : navStyle}
                  >
                    {page.label}
                  </Link>
                ))}
              </nav>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="btn-press rounded-full border px-3.5 py-2 text-sm font-semibold transition hover:opacity-90"
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

          <p className="mt-3 max-w-3xl text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
            {summary}
          </p>
        </div>
      </header>

      {children}
    </main>
  );
}
