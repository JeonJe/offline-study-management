import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import {
  isAuthenticatedForUnit,
} from "@/lib/auth";
import {
  cachedGetMemberAttendanceByPeriod,
  cachedGetTeamAttendanceByPeriod,
} from "@/lib/cached-queries";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  type MemberAttendanceRow,
  type TeamAttendanceRow,
} from "@/lib/history-store";
import { compareText } from "@/lib/sort-utils";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type HistoryTab = "team" | "member";

type PeriodRange = {
  start: string;
  end: string;
};

type HistoryData = {
  teams: TeamAttendanceRow[];
  members: MemberAttendanceRow[];
  error: boolean;
};

type HistoryQuery = {
  tab: HistoryTab;
  period: PeriodRange;
  unitSlug: string;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function currentQuarterRange(date: Date): PeriodRange {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3);
  const start = new Date(Date.UTC(year, quarter * 3, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  };
}

function normalizeTab(value: string): HistoryTab {
  return value === "member" ? "member" : "team";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizePeriod(query: Record<string, string | string[] | undefined>): PeriodRange {
  const fallback = currentQuarterRange(new Date());
  const start = singleParam(query.start);
  const end = singleParam(query.end);

  if (!isIsoDate(start) || !isIsoDate(end) || start > end) {
    return fallback;
  }

  return { start, end };
}

function historyHref({
  tab,
  period,
  unitSlug,
}: HistoryQuery): string {
  const params = new URLSearchParams({
    tab,
    start: period.start,
    end: period.end,
  });
  return cohortAwarePath(unitSlug, `/admin/history?${params.toString()}`);
}

function sortTeams(rows: TeamAttendanceRow[]): TeamAttendanceRow[] {
  return [...rows].sort((a, b) => b.rate - a.rate || b.attended - a.attended || compareText(a.team, b.team));
}

function sortMembers(rows: MemberAttendanceRow[]): MemberAttendanceRow[] {
  return [...rows].sort((a, b) => {
    const totalA = a.meetings + a.afterparties;
    const totalB = b.meetings + b.afterparties;
    return totalB - totalA || b.meetings - a.meetings || compareText(a.name, b.name);
  });
}

async function safeLoadHistory(
  start: string,
  end: string,
  unitSlug: string
): Promise<HistoryData> {
  try {
    const [teams, members] = await Promise.all([
      cachedGetTeamAttendanceByPeriod(start, end, unitSlug),
      cachedGetMemberAttendanceByPeriod(start, end, unitSlug),
    ]);
    return { teams, members, error: false };
  } catch (error) {
    console.error("[history] load failed:", error);
    return { teams: [], members: [], error: true };
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function periodLabel(period: PeriodRange): string {
  return `${period.start} ~ ${period.end}`;
}

function SummaryStrip({ data }: { data: HistoryData }) {
  const averageTeamRate =
    data.teams.length > 0
      ? data.teams.reduce((sum, row) => sum + row.rate, 0) / data.teams.length
      : 0;
  const teamAttendances = data.teams.reduce((sum, row) => sum + row.attended, 0);
  const memberActivities = data.members.reduce((sum, row) => sum + row.meetings + row.afterparties, 0);

  const items = [
    { label: "팀", value: `${data.teams.length}개` },
    { label: "평균 참여율", value: percent(averageTeamRate) },
    { label: "팀 참석 합계", value: `${teamAttendances}회` },
    { label: "멤버 활동 합계", value: `${memberActivities}회` },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
            {item.label}
          </p>
          <p className="mt-1 text-xl font-extrabold" style={{ color: "var(--ink)" }}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function TabLink({
  tab,
  active,
  period,
  unitSlug,
  children,
}: {
  tab: HistoryTab;
  active: boolean;
  period: PeriodRange;
  unitSlug: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={historyHref({ tab, period, unitSlug })}
      className="rounded-lg px-3 py-1.5 text-sm font-bold"
      style={{
        backgroundColor: active ? "var(--surface)" : "transparent",
        color: active ? "var(--accent-strong)" : "var(--ink-soft)",
        border: active ? "1px solid rgba(13, 127, 242, 0.2)" : "1px solid transparent",
      }}
    >
      {children}
    </Link>
  );
}

function TeamStatsList({
  rows,
  period,
  unitSlug,
}: {
  rows: TeamAttendanceRow[];
  period: PeriodRange;
  unitSlug: string;
}) {
  const sortedRows = sortTeams(rows);

  return (
    <div className="grid gap-2">
      {sortedRows.map((row) => {
        const href = cohortAwarePath(unitSlug, `/admin/history/teams/${encodeURIComponent(row.team)}?${new URLSearchParams({
          start: period.start,
          end: period.end,
        }).toString()}`);

        return (
        <Link
          key={row.team}
          href={href}
          className="group rounded-xl border bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold group-hover:underline" style={{ color: "var(--ink)" }}>
                {row.team}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                참석 {row.attended}회 / 전체 {row.meetings}회
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold" style={{ color: "var(--accent-strong)" }}>
                {percent(row.rate)}
              </p>
              <p className="text-[11px] font-semibold" style={{ color: "var(--ink-muted)" }}>
                참여율
              </p>
            </div>
          </div>
        </Link>
        );
      })}
    </div>
  );
}

function MemberStatsList({
  rows,
  period,
  unitSlug,
}: {
  rows: MemberAttendanceRow[];
  period: PeriodRange;
  unitSlug: string;
}) {
  const sortedRows = sortMembers(rows);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {sortedRows.map((row) => {
        const total = row.meetings + row.afterparties;
        const href = cohortAwarePath(unitSlug, `/admin/history/members/${encodeURIComponent(row.name)}?${new URLSearchParams({
          start: period.start,
          end: period.end,
        }).toString()}`);

        return (
          <Link
            key={row.name}
            href={href}
            className="group rounded-xl border bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold group-hover:underline" style={{ color: "var(--ink)" }}>
                  {row.name}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                  모임 {row.meetings}회 · 뒷풀이 {row.afterparties}회
                </p>
              </div>
              <span className="rounded-lg border px-2 py-1 text-sm font-extrabold" style={{ borderColor: "var(--line)", color: "var(--accent-strong)" }}>
                {total}회
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function HistoryPanel({
  data,
  period,
  tab,
  unitSlug,
}: {
  data: HistoryData;
  period: PeriodRange;
  tab: HistoryTab;
  unitSlug: string;
}) {
  const activeRows = tab === "team" ? data.teams : data.members;

  return (
    <section className="grid gap-5">
      <section className="app-section p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              참여 통계
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              선택한 기간의 팀과 멤버 참여 흐름을 확인합니다.
            </p>
            <p className="mt-1 text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
              {periodLabel(period)}
            </p>
          </div>
          <div className="flex rounded-xl border p-1" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
            <TabLink tab="team" active={tab === "team"} period={period} unitSlug={unitSlug}>팀별</TabLink>
            <TabLink tab="member" active={tab === "member"} period={period} unitSlug={unitSlug}>멤버별</TabLink>
          </div>
        </div>

        <form action={cohortAwarePath(unitSlug, "/admin/history")} className="mt-5 grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" style={{ borderColor: "var(--line)" }}>
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="unit" value={unitSlug} />
          <label className="grid gap-1.5 text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
            시작일
            <input
              type="date"
              name="start"
              defaultValue={period.start}
              className="h-11 rounded-lg border px-3 text-sm font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
            종료일
            <input
              type="date"
              name="end"
              defaultValue={period.end}
              className="h-11 rounded-lg border px-3 text-sm font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </label>
          <button
            type="submit"
            className="btn-press h-11 rounded-lg px-4 text-sm font-bold text-white"
            style={{ backgroundColor: "var(--accent)" }}
          >
            조회
          </button>
        </form>

        {!data.error ? (
          <div className="mt-5">
            <SummaryStrip data={data} />
          </div>
        ) : null}
      </section>

      <section className="app-section p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
              {tab === "team" ? "팀별 참여율" : "멤버별 참여"}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              {tab === "team" ? "참여율이 높은 팀부터 정렬합니다." : "활동 합계가 높은 멤버부터 정렬합니다."}
            </p>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
            {activeRows.length}건
          </span>
        </div>

        {data.error ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            참여 통계를 불러오지 못했습니다.
          </div>
        ) : activeRows.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            표시할 참여 데이터가 없습니다.
          </div>
        ) : tab === "team" ? (
          <TeamStatsList rows={data.teams} period={period} unitSlug={unitSlug} />
        ) : (
          <MemberStatsList rows={data.members} period={period} unitSlug={unitSlug} />
        )}
      </section>
    </section>
  );
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const query = await searchParams;
  const unitSlug = singleParam(query.unit).trim();
  if (!unitSlug) {
    notFound();
  }

  const authenticated = await isAuthenticatedForUnit(unitSlug);
  if (!authenticated) {
    redirect(`/?auth=required&unit=${encodeURIComponent(unitSlug)}`);
  }

  const currentRole = await getCurrentRolePageRole();
  const page = getRolePage("admin");
  const access = canOpenRolePage("admin", currentRole, getConfiguredRolePages());

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = <RoleAccessRequired role="admin" label={page.label} invalid={false} />;
  } else {
    const period = normalizePeriod(query);
    const tab = normalizeTab(singleParam(query.tab));
    const data = await safeLoadHistory(period.start, period.end, unitSlug);
    content = <HistoryPanel data={data} period={period} tab={tab} unitSlug={unitSlug} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="참여 통계"
      summary="팀과 멤버의 참여 흐름을 확인합니다."
      unitSlug={unitSlug}
    >
      {content}
    </RoleShell>
  );
}
