import Link from "next/link";
import Image from "next/image";
import { logoutAction } from "@/app/actions";
import { cohortAwarePath } from "@/lib/cohort-routes";
import { DEFAULT_OPERATING_UNIT_NAME } from "@/lib/operating-unit-store";
import type { CSSProperties, ReactNode } from "react";

type DashboardTab = "loopPak" | "study" | "afterparty" | "members" | "angel" | "admin";

type DashboardHeaderProps = {
  title: string;
  activeTab: DashboardTab;
  currentDate?: string;
  unitSlug?: string;
  extraActions?: ReactNode;
};

const TAB_ITEMS: { key: DashboardTab; href: string; label: string }[] = [
  { key: "loopPak", href: "/loop-pak", label: "루프팩" },
  { key: "study", href: "/", label: "스터디" },
  { key: "afterparty", href: "/afterparty", label: "뒷풀이" },
  { key: "members", href: "/members", label: "멤버" },
  { key: "angel", href: "/angel", label: "엔젤" },
  { key: "admin", href: "/admin", label: "관리자" },
];

const INACTIVE_TAB_STYLE: CSSProperties = {
  borderColor: "var(--line)",
  color: "var(--ink-soft)",
  backgroundColor: "var(--surface)",
};

const ACTIVE_TAB_STYLE: CSSProperties = {
  borderColor: "rgba(13, 127, 242, 0.35)",
  color: "var(--accent-strong)",
  backgroundColor: "var(--accent-weak)",
};

export function DashboardHeader({
  title,
  activeTab,
  currentDate,
  unitSlug = "",
  extraActions,
}: DashboardHeaderProps) {
  function tabHref(tab: { key: DashboardTab; href: string }): string {
    const href = cohortAwarePath(unitSlug, tab.href);
    if (!currentDate) return href;
    if (tab.key !== "loopPak" && tab.key !== "study" && tab.key !== "afterparty") return href;
    return `${href}?date=${encodeURIComponent(currentDate)}`;
  }

  return (
    <>
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
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-sm"
                style={{ borderColor: "rgba(17, 24, 39, 0.18)", backgroundColor: "#050506" }}
              >
                <Image
                  src="/loopers-meetup-icon.svg"
                  alt="LOOPERS MEETUP"
                  width={36}
                  height={36}
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--ink-muted)" }}>
                  LOOPERS MEETUP
                </p>
                <h1
                  className="truncate text-xl font-extrabold tracking-tight sm:text-2xl"
                  style={{ fontFamily: "var(--font-heading), sans-serif", color: "var(--ink)" }}
                >
                  {title}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--ink-soft)" }}
                aria-label={`현재 항목 ${DEFAULT_OPERATING_UNIT_NAME}`}
              >
                {DEFAULT_OPERATING_UNIT_NAME}
              </span>
              <nav className="flex flex-wrap items-center gap-2" aria-label="대시보드 탭 이동">
                {TAB_ITEMS.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tabHref(tab)}
                    aria-current={activeTab === tab.key ? "page" : undefined}
                    className="btn-press rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-85"
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
        </div>
      </header>
      <div className="h-[96px] sm:h-[60px]" aria-hidden="true" />
    </>
  );
}
