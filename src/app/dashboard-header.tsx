import Link from "next/link";
import { logoutAction } from "@/app/actions";
import type { CSSProperties, ReactNode } from "react";

type DashboardTab = "study" | "afterparty" | "members";

type DashboardHeaderProps = {
  title: string;
  activeTab: DashboardTab;
  currentDate?: string;
  extraActions?: ReactNode;
};

const TAB_ITEMS: { key: DashboardTab; href: string; label: string }[] = [
  { key: "study", href: "/", label: "스터디" },
  { key: "afterparty", href: "/afterparty", label: "뒷풀이" },
  { key: "members", href: "/members", label: "멤버" },
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
  extraActions,
}: DashboardHeaderProps) {
  function tabHref(tab: { key: DashboardTab; href: string }): string {
    if (!currentDate) return tab.href;
    if (tab.key !== "study" && tab.key !== "afterparty") return tab.href;
    return `${tab.href}?date=${encodeURIComponent(currentDate)}`;
  }

  return (
    <header
      className="card-static sticky top-3 z-30 mb-5 px-4 py-4 sm:px-6 fade-in"
      style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(255, 255, 255, 0.92)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold text-white sm:h-11 sm:w-11"
            style={{ backgroundColor: "var(--accent)" }}
            aria-hidden="true"
          >
            SM
          </div>
          <div className="min-w-0">
            <p
              className="truncate text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--accent-strong)" }}
            >
              Saturday Meetup
            </p>
            <h1
              className="truncate text-2xl font-extrabold tracking-tight sm:text-[2rem]"
              style={{ fontFamily: "var(--font-heading), sans-serif", color: "var(--ink)" }}
            >
              {title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap items-center gap-2" aria-label="대시보드 탭 이동">
            {TAB_ITEMS.map((tab) => (
              <Link
                key={tab.key}
                href={tabHref(tab)}
                aria-current={activeTab === tab.key ? "page" : undefined}
                className="btn-press rounded-full border px-3.5 py-2 text-sm font-semibold transition hover:opacity-85"
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
      {currentDate ? (
        <p className="mt-3 text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
          기준일 {currentDate}
        </p>
      ) : null}
    </header>
  );
}
