import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import {
  isAuthenticatedForUnit,
} from "@/lib/auth";
import { cachedGetMemberAttendanceDetailByPeriod } from "@/lib/cached-queries";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  type MemberAttendanceDetail,
  type MemberAttendanceDetailItem,
} from "@/lib/history-store";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type MemberHistoryPageProps = {
  params: Promise<{ name: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PeriodRange = {
  start: string;
  end: string;
};

type MemberHistoryData = {
  detail: MemberAttendanceDetail;
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

function decodeMemberName(value: string): string {
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
    tab: "member",
    start: period.start,
    end: period.end,
  }).toString()}`);
}

async function safeLoadMemberHistory(
  name: string,
  period: PeriodRange,
  unitSlug: string
): Promise<MemberHistoryData> {
  try {
    const detail = await cachedGetMemberAttendanceDetailByPeriod(name, period.start, period.end, unitSlug);
    return { detail, error: false };
  } catch (error) {
    console.error("[history:member] load failed:", error);
    return {
      detail: { name, meetings: 0, afterparties: 0, totalMeetings: 0, totalAfterparties: 0, items: [] },
      error: true,
    };
  }
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

function kindLabel(kind: MemberAttendanceDetailItem["kind"]): string {
  return kind === "meeting" ? "모임" : "뒷풀이";
}

function kindStyle(kind: MemberAttendanceDetailItem["kind"]) {
  return kind === "meeting"
    ? {
        borderColor: "rgba(13, 127, 242, 0.25)",
        backgroundColor: "var(--accent-weak)",
        color: "var(--accent-strong)",
      }
    : {
        borderColor: "rgba(15, 118, 110, 0.22)",
        backgroundColor: "rgba(240, 253, 250, 0.95)",
        color: "#0f766e",
      };
}

function rateLabel(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function detailHref(item: MemberAttendanceDetailItem, unitSlug: string): string {
  const path = item.kind === "meeting"
    ? `/meetings/${encodeURIComponent(item.id)}?date=${encodeURIComponent(item.eventDate)}`
    : `/afterparty/${encodeURIComponent(item.id)}?date=${encodeURIComponent(item.eventDate)}`;

  return cohortAwarePath(unitSlug, path);
}

function DetailList({
  items,
  unitSlug,
}: {
  items: MemberAttendanceDetailItem[];
  unitSlug: string;
}) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Link
          key={`${item.kind}-${item.id}`}
          href={detailHref(item, unitSlug)}
          className="group rounded-xl border bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-2.5 py-1 text-xs font-bold" style={kindStyle(item.kind)}>
                  {kindLabel(item.kind)}
                </span>
                <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
                  {item.eventDate} {item.startTime}
                </span>
              </div>
              <h3 className="mt-2 truncate text-base font-extrabold" style={{ color: "var(--ink)" }}>
                {item.title}
              </h3>
            </div>
            <span className="text-xs font-bold opacity-0 transition group-hover:opacity-100" style={{ color: "var(--accent-strong)" }}>
              상세 보기
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function MemberHistoryPanel({
  name,
  period,
  data,
  unitSlug,
}: {
  name: string;
  period: PeriodRange;
  data: MemberHistoryData;
  unitSlug: string;
}) {
  const total = data.detail.meetings + data.detail.afterparties;

  return (
    <section className="grid gap-5">
      <section className="app-section p-5 sm:p-6">
        <Link
          href={historyListHref(period, unitSlug)}
          className="text-sm font-bold hover:underline"
          style={{ color: "var(--accent-strong)" }}
        >
          ← 멤버별 참여로 돌아가기
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
              {name}
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              선택한 기간의 모임과 뒷풀이 참여 내역입니다.
            </p>
          </div>
          <span className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}>
            {periodLabel(period)}
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          <SummaryCard label="총 참여" value={`${total}회`} />
          <SummaryCard label="모임 참여율" value={`${data.detail.meetings}/${data.detail.totalMeetings} (${rateLabel(data.detail.meetings, data.detail.totalMeetings)})`} />
          <SummaryCard label="뒷풀이 참여율" value={`${data.detail.afterparties}/${data.detail.totalAfterparties} (${rateLabel(data.detail.afterparties, data.detail.totalAfterparties)})`} />
          <SummaryCard label="참여 내역" value={`${data.detail.items.length}건`} />
        </div>
      </section>

      <section className="app-section p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
              참여 내역
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              최근 일정부터 정렬합니다.
            </p>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
            {data.detail.items.length}건
          </span>
        </div>

        {data.error ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            멤버 참여 내역을 불러오지 못했습니다.
          </div>
        ) : data.detail.items.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
            선택한 기간에 표시할 참여 내역이 없습니다.
          </div>
        ) : (
          <DetailList items={data.detail.items} unitSlug={unitSlug} />
        )}
      </section>
    </section>
  );
}

export default async function MemberHistoryPage({
  params,
  searchParams,
}: MemberHistoryPageProps) {
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
  const name = decodeMemberName(routeParams.name);

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = <RoleAccessRequired role="admin" label={page.label} invalid={false} />;
  } else {
    const data = await safeLoadMemberHistory(name, period, unitSlug);
    content = <MemberHistoryPanel name={name} period={period} data={data} unitSlug={unitSlug} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="멤버 참여 상세"
      summary="멤버별 참여 내역을 확인합니다."
      unitSlug={unitSlug}
    >
      {content}
    </RoleShell>
  );
}
