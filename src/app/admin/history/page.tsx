import Link from "next/link";
import { redirect } from "next/navigation";
import { AttendanceChart } from "@/app/admin/history/attendance-chart";
import { PeriodPicker } from "@/app/admin/history/period-picker";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isGlobalAuthenticated } from "@/lib/auth";
import {
  cachedGetMemberAttendanceByPeriod,
  cachedGetTeamAttendanceByPeriod,
} from "@/lib/cached-queries";
import {
  type MemberAttendanceRow,
  type TeamAttendanceRow,
} from "@/lib/history-store";
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
type SortDirection = "asc" | "desc";
type PeriodPreset = "current-quarter" | "previous-quarter" | "custom";

type PeriodRange = {
  preset: PeriodPreset;
  start: string;
  end: string;
};

type HistoryData = {
  teams: TeamAttendanceRow[];
  members: MemberAttendanceRow[];
  error: boolean;
};

const TEAM_SORTS = new Set(["team", "meetings", "attended", "rate"]);
const MEMBER_SORTS = new Set(["name", "meetings", "afterparties", "total"]);

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function quarterRange(date: Date, offset = 0): { start: string; end: string } {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + offset;
  const start = new Date(Date.UTC(year, quarter * 3, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  };
}

function normalizePeriod(query: Record<string, string | string[] | undefined>): PeriodRange {
  const rawPreset = singleParam(query.preset);
  const preset: PeriodPreset =
    rawPreset === "previous-quarter" || rawPreset === "custom"
      ? rawPreset
      : "current-quarter";
  const currentQuarter = quarterRange(new Date());

  if (preset === "previous-quarter") {
    return { preset, ...quarterRange(new Date(), -1) };
  }

  if (preset === "custom") {
    const start = singleParam(query.start);
    const end = singleParam(query.end);
    return {
      preset,
      start: isIsoDate(start) ? start : currentQuarter.start,
      end: isIsoDate(end) ? end : currentQuarter.end,
    };
  }

  return { preset, ...currentQuarter };
}

function normalizeTab(value: string): HistoryTab {
  return value === "member" ? "member" : "team";
}

function normalizeDirection(value: string): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

function normalizeSort(tab: HistoryTab, value: string): string {
  if (tab === "member") {
    return MEMBER_SORTS.has(value) ? value : "total";
  }

  return TEAM_SORTS.has(value) ? value : "rate";
}

function sortTeams(rows: TeamAttendanceRow[], sort: string, dir: SortDirection): TeamAttendanceRow[] {
  return [...rows].sort((a, b) => {
    const sign = dir === "asc" ? 1 : -1;
    if (sort === "team") return a.team.localeCompare(b.team, "ko") * sign;
    const left = sort === "meetings" ? a.meetings : sort === "attended" ? a.attended : a.rate;
    const right = sort === "meetings" ? b.meetings : sort === "attended" ? b.attended : b.rate;
    return (left - right) * sign || a.team.localeCompare(b.team, "ko");
  });
}

function sortMembers(rows: MemberAttendanceRow[], sort: string, dir: SortDirection): MemberAttendanceRow[] {
  return [...rows].sort((a, b) => {
    const sign = dir === "asc" ? 1 : -1;
    if (sort === "name") return a.name.localeCompare(b.name, "ko") * sign;
    const left =
      sort === "meetings"
        ? a.meetings
        : sort === "afterparties"
          ? a.afterparties
          : a.meetings + a.afterparties;
    const right =
      sort === "meetings"
        ? b.meetings
        : sort === "afterparties"
          ? b.afterparties
          : b.meetings + b.afterparties;
    return (left - right) * sign || a.name.localeCompare(b.name, "ko");
  });
}

function nextSortHref({
  tab,
  sort,
  currentSort,
  dir,
  period,
}: {
  tab: HistoryTab;
  sort: string;
  currentSort: string;
  dir: SortDirection;
  period: PeriodRange;
}): string {
  const params = new URLSearchParams({
    tab,
    preset: period.preset,
    start: period.start,
    end: period.end,
    sort,
    dir: currentSort === sort && dir === "desc" ? "asc" : "desc",
  });
  return `/admin/history?${params.toString()}`;
}

async function safeLoadHistory(start: string, end: string): Promise<HistoryData> {
  try {
    const [teams, members] = await Promise.all([
      cachedGetTeamAttendanceByPeriod(start, end),
      cachedGetMemberAttendanceByPeriod(start, end),
    ]);
    return { teams, members, error: false };
  } catch (error) {
    console.error("[history] load failed:", error);
    return { teams: [], members: [], error: true };
  }
}

function SortLink({
  children,
  href,
  active,
}: {
  children: React.ReactNode;
  href: string;
  active: boolean;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 font-bold" style={{ color: active ? "var(--accent)" : "var(--ink-muted)" }}>
      {children}
    </Link>
  );
}

function TeamTable({
  rows,
  period,
  sort,
  dir,
}: {
  rows: TeamAttendanceRow[];
  period: PeriodRange;
  sort: string;
  dir: SortDirection;
}) {
  const sortedRows = sortTeams(rows, sort, dir);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--line)" }}>
            <th className="px-5 py-3 text-left">
              <SortLink href={nextSortHref({ tab: "team", sort: "team", currentSort: sort, dir, period })} active={sort === "team"}>
                팀
              </SortLink>
            </th>
            <th className="px-5 py-3 text-right">
              <SortLink href={nextSortHref({ tab: "team", sort: "meetings", currentSort: sort, dir, period })} active={sort === "meetings"}>
                전체 모임
              </SortLink>
            </th>
            <th className="px-5 py-3 text-right">
              <SortLink href={nextSortHref({ tab: "team", sort: "attended", currentSort: sort, dir, period })} active={sort === "attended"}>
                참석 모임
              </SortLink>
            </th>
            <th className="px-5 py-3 text-right">
              <SortLink href={nextSortHref({ tab: "team", sort: "rate", currentSort: sort, dir, period })} active={sort === "rate"}>
                참여율
              </SortLink>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.team} style={{ borderBottom: "1px solid var(--line)" }}>
              <td className="px-5 py-3 font-bold" style={{ color: "var(--ink)" }}>{row.team}</td>
              <td className="px-5 py-3 text-right" style={{ color: "var(--ink-soft)" }}>{row.meetings}</td>
              <td className="px-5 py-3 text-right" style={{ color: "var(--ink-soft)" }}>{row.attended}</td>
              <td className="px-5 py-3 text-right font-bold" style={{ color: "var(--accent-strong)" }}>
                {Math.round(row.rate * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberTable({
  rows,
  period,
  sort,
  dir,
}: {
  rows: MemberAttendanceRow[];
  period: PeriodRange;
  sort: string;
  dir: SortDirection;
}) {
  const sortedRows = sortMembers(rows, sort, dir);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--line)" }}>
            <th className="px-5 py-3 text-left">
              <SortLink href={nextSortHref({ tab: "member", sort: "name", currentSort: sort, dir, period })} active={sort === "name"}>
                멤버
              </SortLink>
            </th>
            <th className="px-5 py-3 text-right">
              <SortLink href={nextSortHref({ tab: "member", sort: "meetings", currentSort: sort, dir, period })} active={sort === "meetings"}>
                모임
              </SortLink>
            </th>
            <th className="px-5 py-3 text-right">
              <SortLink href={nextSortHref({ tab: "member", sort: "afterparties", currentSort: sort, dir, period })} active={sort === "afterparties"}>
                뒷풀이
              </SortLink>
            </th>
            <th className="px-5 py-3 text-right">
              <SortLink href={nextSortHref({ tab: "member", sort: "total", currentSort: sort, dir, period })} active={sort === "total"}>
                합계
              </SortLink>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.name} style={{ borderBottom: "1px solid var(--line)" }}>
              <td className="px-5 py-3 font-bold" style={{ color: "var(--ink)" }}>{row.name}</td>
              <td className="px-5 py-3 text-right" style={{ color: "var(--ink-soft)" }}>{row.meetings}</td>
              <td className="px-5 py-3 text-right" style={{ color: "var(--ink-soft)" }}>{row.afterparties}</td>
              <td className="px-5 py-3 text-right font-bold" style={{ color: "var(--accent-strong)" }}>
                {row.meetings + row.afterparties}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryPanel({
  data,
  period,
  tab,
  sort,
  dir,
}: {
  data: HistoryData;
  period: PeriodRange;
  tab: HistoryTab;
  sort: string;
  dir: SortDirection;
}) {
  const activeRows = tab === "team" ? data.teams : data.members;

  return (
    <section className="grid gap-5">
      <section className="card-static p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              팀/멤버 히스토리
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              {period.start}부터 {period.end}까지 참여 흐름을 확인합니다.
            </p>
          </div>
          <div className="flex rounded-full border p-1" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
            {[
              { value: "team", label: "팀별" },
              { value: "member", label: "멤버별" },
            ].map((item) => {
              const params = new URLSearchParams({
                tab: item.value,
                preset: period.preset,
                start: period.start,
                end: period.end,
              });
              return (
                <Link
                  key={item.value}
                  href={`/admin/history?${params.toString()}`}
                  className="rounded-full px-4 py-2 text-sm font-bold"
                  style={{
                    backgroundColor: tab === item.value ? "var(--accent)" : "transparent",
                    color: tab === item.value ? "white" : "var(--ink-soft)",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <PeriodPicker
            preset={period.preset}
            start={period.start}
            end={period.end}
            tab={tab}
            sort={sort}
            dir={dir}
          />
        </div>
      </section>

      {!data.error && tab === "team" ? (
        <AttendanceChart kind="team" rows={data.teams} />
      ) : null}

      {!data.error && tab === "member" ? (
        <AttendanceChart kind="member" rows={data.members} />
      ) : null}

      <section className="card-static overflow-hidden">
        {data.error ? (
          <div className="p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
            히스토리 데이터를 불러오지 못했습니다.
          </div>
        ) : activeRows.length === 0 ? (
          <div className="p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
            선택한 기간에 표시할 데이터가 없습니다.
          </div>
        ) : tab === "team" ? (
          <TeamTable rows={data.teams} period={period} sort={sort} dir={dir} />
        ) : (
          <MemberTable rows={data.members} period={period} sort={sort} dir={dir} />
        )}
      </section>
    </section>
  );
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [currentRole, query] = await Promise.all([
    getCurrentRolePageRole(),
    searchParams,
  ]);
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
    const sort = normalizeSort(tab, singleParam(query.sort));
    const dir = normalizeDirection(singleParam(query.dir));
    const data = await safeLoadHistory(period.start, period.end);
    content = <HistoryPanel data={data} period={period} tab={tab} sort={sort} dir={dir} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="팀/멤버 히스토리"
      summary="기간별 참여 흐름을 표로 확인합니다."
    >
      {content}
    </RoleShell>
  );
}
