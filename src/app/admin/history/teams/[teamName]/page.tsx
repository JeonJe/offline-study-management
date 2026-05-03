import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticatedForUnit } from "@/lib/auth";
import { cachedGetTeamAttendanceDetailByPeriod } from "@/lib/cached-queries";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  type TeamAttendanceDetail,
  type TeamAttendanceDetailItem,
} from "@/lib/history-store";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type TeamHistoryPageProps = {
  params: Promise<{ teamName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PeriodRange = {
  start: string;
  end: string;
};

type TeamHistoryData = {
  detail: TeamAttendanceDetail;
  error: boolean;
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

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function periodLabel(period: PeriodRange): string {
  return `${period.start} ~ ${period.end}`;
}

function historyListHref(period: PeriodRange, unitSlug: string): string {
  return cohortAwarePath(unitSlug, `/admin/history?${new URLSearchParams({
    tab: "team",
    start: period.start,
    end: period.end,
  }).toString()}`);
}

async function safeLoadTeamHistory(
  teamName: string,
  period: PeriodRange,
  unitSlug: string
): Promise<TeamHistoryData> {
  try {
    const detail = await cachedGetTeamAttendanceDetailByPeriod(teamName, period.start, period.end, unitSlug);
    return { detail, error: false };
  } catch (error) {
    console.error("[history:team] load failed:", error);
    return {
      detail: { team: teamName, meetings: 0, attended: 0, rate: 0, members: [], items: [] },
      error: true,
    };
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: "var(--line)" }}>
      <p className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
        {value}
      </p>
    </div>
  );
}

function MeetingRow({
  item,
  unitSlug,
}: {
  item: TeamAttendanceDetailItem;
  unitSlug: string;
}) {
  const attended = item.attendedMembers > 0;
  const attendanceLabel = attended ? "팀원 참여" : "팀원 미참여";
  const accentColor = attended ? "var(--accent)" : "#94a3b8";
  const href = cohortAwarePath(unitSlug, `/meetings/${encodeURIComponent(item.id)}?date=${encodeURIComponent(item.eventDate)}`);

  return (
    <Link
      href={href}
      className="group rounded-xl border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm"
      style={{
        borderColor: attended ? "rgba(13, 127, 242, 0.22)" : "var(--line)",
        backgroundColor: attended ? "rgba(239, 246, 255, 0.9)" : "rgba(248, 250, 252, 0.95)",
        boxShadow: `inset 4px 0 0 ${accentColor}`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-2.5 py-1 text-xs font-bold"
              style={{
                borderColor: attended ? "rgba(13, 127, 242, 0.25)" : "var(--line)",
                backgroundColor: attended ? "var(--accent-weak)" : "var(--surface)",
                color: attended ? "var(--accent-strong)" : "var(--ink-muted)",
              }}
            >
              {attendanceLabel}
            </span>
            <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
              {item.eventDate} {item.startTime}
            </span>
          </div>
          <h3 className="mt-2 truncate text-base font-extrabold" style={{ color: "var(--ink)" }}>
            {item.title}
          </h3>
          {item.attendees.length > 0 ? (
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--ink-muted)" }}>
              참석 팀원: {item.attendees.join(", ")}
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--ink-muted)" }}>
              이 팀에서 참석한 멤버가 없습니다.
            </p>
          )}
        </div>
        <span className="rounded-lg border px-2 py-1 text-xs font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
          {attended ? `팀원 ${item.attendedMembers}명` : "팀원 0명"}
        </span>
      </div>
    </Link>
  );
}

function TeamHistoryPanel({
  teamName,
  period,
  data,
  unitSlug,
}: {
  teamName: string;
  period: PeriodRange;
  data: TeamHistoryData;
  unitSlug: string;
}) {
  const attendedItems = data.detail.items.filter((item) => item.attendedMembers > 0);

  return (
    <section className="grid gap-5">
      <section className="app-section p-5 sm:p-6">
        <Link
          href={historyListHref(period, unitSlug)}
          className="text-sm font-bold hover:underline"
          style={{ color: "var(--accent-strong)" }}
        >
          ← 팀별 참여율로 돌아가기
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              {teamName}
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              선택한 기간의 팀 참여율과 모임별 참석자를 확인합니다.
            </p>
          </div>
          <span className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}>
            {periodLabel(period)}
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          <SummaryCard label="팀 참여율" value={percent(data.detail.rate)} />
          <SummaryCard label="참여 모임" value={`${data.detail.attended}/${data.detail.meetings}`} />
          <SummaryCard label="팀원" value={`${data.detail.members.length}명`} />
          <SummaryCard label="표시 내역" value={`${attendedItems.length}건`} />
        </div>

        {data.detail.members.length > 0 ? (
          <div className="mt-4 rounded-xl border bg-white px-4 py-3" style={{ borderColor: "var(--line)" }}>
            <p className="text-xs font-bold" style={{ color: "var(--ink-muted)" }}>
              팀원
            </p>
            <p className="mt-1 text-sm leading-6" style={{ color: "var(--ink)" }}>
              {data.detail.members.join(", ")}
            </p>
          </div>
        ) : null}
      </section>

      <section className="app-section p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
              모임별 참여
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              이 팀 소속 멤버가 참석한 모임만 표시합니다.
            </p>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
            {attendedItems.length}건
          </span>
        </div>

        {data.error ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            팀 참여 내역을 불러오지 못했습니다.
          </div>
        ) : attendedItems.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            선택한 기간에 이 팀이 참여한 모임이 없습니다.
          </div>
        ) : (
          <div className="grid gap-2">
            {attendedItems.map((item) => (
              <MeetingRow key={item.id} item={item} unitSlug={unitSlug} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default async function TeamHistoryPage({
  params,
  searchParams,
}: TeamHistoryPageProps) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
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
  const period = normalizePeriod(query);
  const teamName = decodeParam(routeParams.teamName);

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = <RoleAccessRequired role="admin" label={page.label} invalid={false} />;
  } else {
    const data = await safeLoadTeamHistory(teamName, period, unitSlug);
    content = <TeamHistoryPanel teamName={teamName} period={period} data={data} unitSlug={unitSlug} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="팀 참여 상세"
      summary="팀별 참여율과 모임별 참석자를 확인합니다."
      unitSlug={unitSlug}
    >
      {content}
    </RoleShell>
  );
}
