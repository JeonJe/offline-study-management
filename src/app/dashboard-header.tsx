import Link from "next/link";
import Image from "next/image";
import { logoutAction } from "@/app/actions";
import { cohortAwarePath } from "@/lib/cohort-routes";
import { operatingUnitDisplayName } from "@/lib/operating-unit-store";
import type { CSSProperties, ReactNode } from "react";

export type DashboardTab = "loopPak" | "study" | "afterparty" | "angel" | "admin";

type DashboardHeaderProps = {
  title: string;
  activeTab: DashboardTab;
  currentDate?: string;
  unitSlug?: string;
  scopeLabel?: string;
  extraActions?: ReactNode;
};

const TAB_ITEMS: { key: DashboardTab; href: string; label: string }[] = [
  { key: "loopPak", href: "/loop-pak", label: "루프팩" },
  { key: "study", href: "/", label: "스터디" },
  { key: "afterparty", href: "/afterparty", label: "뒷풀이" },
  { key: "angel", href: "/angel", label: "엔젤" },
  { key: "admin", href: "/admin", label: "관리자" },
];

const INACTIVE_TAB_STYLE: CSSProperties = {
  borderColor: "transparent",
  color: "var(--ink-soft)",
  backgroundColor: "transparent",
};

const ACTIVE_TAB_STYLE: CSSProperties = {
  borderColor: "rgba(13, 127, 242, 0.2)",
  color: "var(--accent-strong)",
  backgroundColor: "var(--surface)",
};

export function DashboardHeader({
  title,
  activeTab,
  currentDate,
  unitSlug = "",
  scopeLabel,
  extraActions,
}: DashboardHeaderProps) {
  const unitLabel = scopeLabel ?? operatingUnitDisplayName(unitSlug);

  function tabHref(tab: { key: DashboardTab; href: string }): string {
    const href = cohortAwarePath(unitSlug, tab.href);
    if (!currentDate) return href;
    if (tab.key !== "loopPak" && tab.key !== "study" && tab.key !== "afterparty") return href;
    return `${href}?date=${encodeURIComponent(currentDate)}`;
  }

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-40 border-b px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8"
        style={{
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(255, 255, 255, 0.97)",
          borderColor: "var(--line)",
        }}
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-1.5 sm:flex sm:items-center sm:justify-between sm:gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-sm"
                style={{ borderColor: "rgba(17, 24, 39, 0.18)", backgroundColor: "#050506" }}
              >
                <Image
                  src="/loopers-meetup-icon.svg"
                  alt="LOOPERS MEETUP"
                  width={32}
                  height={32}
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--ink-muted)" }}>
                  LOOPERS MEETUP
                </p>
                <h1
                  className="truncate text-base font-extrabold tracking-tight sm:text-lg"
                  style={{ fontFamily: "var(--font-heading), sans-serif", color: "var(--ink)" }}
                >
                  {title}
                </h1>
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-between gap-1.5 sm:justify-end">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "var(--ink-muted)" }}
                aria-label={`현재 항목 ${unitLabel}`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--accent)" }} aria-hidden="true" />
                {unitLabel}
              </span>
              <nav className="hidden shrink-0 flex-nowrap items-center gap-1 rounded-lg border p-1 sm:flex" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }} aria-label="대시보드 탭 이동">
                {TAB_ITEMS.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tabHref(tab)}
                    aria-current={activeTab === tab.key ? "page" : undefined}
                    className="btn-press inline-flex min-h-8 items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:opacity-85"
                    style={activeTab === tab.key ? ACTIVE_TAB_STYLE : INACTIVE_TAB_STYLE}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>

              {extraActions}

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="btn-press min-h-8 shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
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

            <nav className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border p-1 sm:hidden" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }} aria-label="대시보드 탭 이동">
              {TAB_ITEMS.map((tab) => (
                <Link
                  key={`mobile-${tab.key}`}
                  href={tabHref(tab)}
                  aria-current={activeTab === tab.key ? "page" : undefined}
                  className="btn-press inline-flex min-h-8 shrink-0 items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:opacity-85"
                  style={activeTab === tab.key ? ACTIVE_TAB_STYLE : INACTIVE_TAB_STYLE}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <div className="h-[158px] sm:h-[82px]" aria-hidden="true" />
    </>
  );
}
