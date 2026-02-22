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
  { key: "study", href: "/", label: "오프라인 스터디" },
  { key: "afterparty", href: "/afterparty", label: "뒷풀이 관리" },
  { key: "members", href: "/members", label: "멤버 관리" },
];

const INACTIVE_TAB_STYLE: CSSProperties = {
  borderColor: "var(--line)",
  color: "var(--ink-soft)",
  backgroundColor: "var(--surface)",
};

const ACTIVE_TAB_STYLE: CSSProperties = {
  borderColor: "var(--accent)",
  color: "var(--accent)",
  backgroundColor: "rgba(194, 65, 12, 0.08)",
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
    <header className="card-static mb-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6 fade-in">
      <div>
        <p className="text-xs font-semibold tracking-widest" style={{ color: "var(--accent)" }}>
          SATURDAY MEETUP
        </p>
        <h1
          className="text-2xl tracking-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-instrument-serif), serif", color: "var(--ink)" }}
        >
          {title}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap items-center gap-2" aria-label="대시보드 탭 이동">
          {TAB_ITEMS.map((tab) => (
            <Link
              key={tab.key}
              href={tabHref(tab)}
              aria-current={activeTab === tab.key ? "page" : undefined}
              className="btn-press rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-80"
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
            className="btn-press rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-90"
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
    </header>
  );
}
