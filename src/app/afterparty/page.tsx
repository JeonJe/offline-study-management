import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createAfterpartyAction,
} from "@/app/actions";
import { DatePicker } from "@/app/date-picker";
import { DashboardHeader } from "@/app/dashboard-header";
import { MeetingShareButton } from "@/app/meeting-share-button";
import { isAuthenticated } from "@/lib/auth";
import { toKstIsoDate } from "@/lib/date-utils";
import { extractHttpUrl } from "@/lib/location-utils";
import { normalizeMemberName, toTeamLabel, withTeamLabel } from "@/lib/member-label-utils";
import {
  listAfterparties,
  listAfterpartiesByDate,
  listParticipantsForAfterparties,
  listSettlementsForAfterparties,
  type AfterpartyParticipant,
  type AfterpartySettlement,
  type AfterpartySummary,
} from "@/lib/afterparty-store";
import type { ParticipantRole } from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";
import {
  PARTICIPANT_ROLE_META,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";

type SearchParams = Record<string, string | string[] | undefined>;

type AfterpartyPageProps = {
  searchParams: Promise<SearchParams>;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value);
}

function formatStartTime(timeText: string): string {
  const [hourText, minuteText] = timeText.split(":");
  const hour = Number.parseInt(hourText ?? "", 10);
  const minute = Number.parseInt(minuteText ?? "", 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return timeText;
  }

  const period = hour >= 12 ? "오후" : "오전";
  const hour12 = hour % 12 || 12;
  return `${period} ${hour12}:${String(minute).padStart(2, "0")}`;
}

function LocationValue({ location }: { location: string }) {
  const placeLink = extractHttpUrl(location);
  if (!placeLink) {
    return <>{location}</>;
  }

  return (
    <a
      href={placeLink}
      target="_blank"
      rel="noreferrer noopener"
      className="underline decoration-1 underline-offset-2 transition hover:opacity-80"
      style={{ color: "#0369a1" }}
    >
      {location}
    </a>
  );
}

type DecoratedAfterpartyParticipant = AfterpartyParticipant & {
  teamLabel: string;
  teamOrder: number;
  displayName: string;
};

function AfterpartyParticipantChip({ participant }: { participant: DecoratedAfterpartyParticipant }) {
  const roleMeta = PARTICIPANT_ROLE_META[participant.role];
  return (
    <li
      className="inline-flex h-6 items-center rounded-full border px-2 leading-none"
      style={{
        borderColor: roleMeta.borderColor,
        backgroundColor: roleMeta.backgroundColor,
        color: roleMeta.textColor,
      }}
    >
      <span className="block text-xs font-medium leading-none">
        {roleMeta.emoji ? `${roleMeta.emoji} ` : ""}{participant.displayName}
      </span>
    </li>
  );
}

function CreateAfterpartyModal({ selectedDate }: { selectedDate: string }) {
  return (
    <details className="fixed bottom-6 right-6 z-40">
      <summary
        className="fab-pulse flex h-14 w-14 cursor-pointer list-none items-center justify-center rounded-full text-2xl font-semibold text-white shadow-lg transition hover:scale-105"
        style={{ backgroundColor: "var(--accent)" }}
      >
        +
      </summary>

      <div
        className="absolute bottom-18 right-0 w-[min(92vw,760px)] rounded-2xl border p-4 shadow-2xl backdrop-blur-md fade-in"
        style={{ borderColor: "var(--line)", backgroundColor: "rgba(255, 253, 249, 0.92)" }}
      >
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--ink)" }}>뒷풀이 만들기</p>
        <form action={createAfterpartyAction} className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="returnDate" value={selectedDate} />

          <label className="grid gap-1 text-sm lg:col-span-2" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">뒷풀이 이름</span>
            <input
              name="title"
              required
              maxLength={80}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 홍대 저녁 뒷풀이"
            />
          </label>

          <label className="grid gap-1 text-sm" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">날짜</span>
            <input
              name="eventDate"
              type="date"
              defaultValue={selectedDate}
              required
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
            />
          </label>

          <label className="grid gap-1 text-sm" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">시작 시간</span>
            <input
              name="startTime"
              type="time"
              defaultValue="19:00"
              required
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2 lg:col-span-2" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">장소/주소</span>
            <input
              name="location"
              required
              maxLength={160}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 합정역 근처"
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2 lg:col-span-4" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">메모 (선택)</span>
            <input
              name="description"
              maxLength={240}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 2차 참석 가능 인원 체크"
            />
          </label>

          <button
            type="submit"
            className="btn-press h-10 self-end rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--success)" }}
          >
            생성
          </button>
        </form>
      </div>
    </details>
  );
}

function AfterpartyCard({
  afterparty,
  settlements,
  participants,
  selectedDate,
  teamLabelByMemberName,
}: {
  afterparty: AfterpartySummary;
  settlements: AfterpartySettlement[];
  participants: AfterpartyParticipant[];
  selectedDate: string;
  teamLabelByMemberName: Map<string, string>;
}) {
  const detailPath = `/afterparty/${afterparty.id}?date=${selectedDate}`;
  const sortedParticipants: DecoratedAfterpartyParticipant[] = [...participants]
    .map((participant) => {
      const normalizedName = normalizeMemberName(participant.name);
      const teamLabel = teamLabelByMemberName.get(normalizedName) ?? "";
      const teamNumberMatch = teamLabel.match(/(\d+)\s*팀/);
      const teamOrder = teamNumberMatch?.[1] ? Number.parseInt(teamNumberMatch[1], 10) : Number.POSITIVE_INFINITY;
      const displayName = withTeamLabel(participant.name, teamLabelByMemberName);

      return {
        ...participant,
        teamLabel,
        teamOrder,
        displayName,
      };
    })
    .sort((a, b) => {
      const aRoleOrder = PARTICIPANT_ROLE_ORDER.indexOf(a.role);
      const bRoleOrder = PARTICIPANT_ROLE_ORDER.indexOf(b.role);
      if (aRoleOrder !== bRoleOrder) return aRoleOrder - bRoleOrder;

      const aHasTeam = Boolean(a.teamLabel);
      const bHasTeam = Boolean(b.teamLabel);
      if (aHasTeam !== bHasTeam) return aHasTeam ? -1 : 1;

      if (a.teamOrder !== b.teamOrder) return a.teamOrder - b.teamOrder;
      if (a.teamLabel !== b.teamLabel) return a.teamLabel.localeCompare(b.teamLabel, "ko");
      return a.displayName.localeCompare(b.displayName, "ko");
    });
  const participantsByRole = new Map<ParticipantRole, DecoratedAfterpartyParticipant[]>();
  for (const role of PARTICIPANT_ROLE_ORDER) {
    participantsByRole.set(role, []);
  }
  for (const participant of sortedParticipants) {
    const existing = participantsByRole.get(participant.role) ?? [];
    existing.push(participant);
    participantsByRole.set(participant.role, existing);
  }
  const visibleRoleGroups = PARTICIPANT_ROLE_ORDER.map((role) => ({
    role,
    rows: participantsByRole.get(role) ?? [],
  })).filter((group) => group.rows.length > 0);
  return (
    <article id={`afterparty-${afterparty.id}`} className="card study-card relative p-4 sm:p-5">
      <Link
        href={detailPath}
        aria-label={`${afterparty.title} 상세 보기`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2"
        style={{ "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
      >
        <span className="sr-only">{afterparty.title} 상세 보기</span>
      </Link>

      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{afterparty.title}</p>
            <span
              className="inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold leading-none"
              style={{ backgroundColor: "rgba(3, 105, 161, 0.12)", color: "#0369a1" }}
            >
              <span className="inline-block leading-none">{formatStartTime(afterparty.startTime)}</span>
            </span>
          </div>
          <p className="mt-1 break-all text-xs" style={{ color: "var(--ink-soft)" }}>
            <span className="font-semibold">장소:</span> <LocationValue location={afterparty.location} />
          </p>
          <p className="mt-1 break-all text-xs" style={{ color: "var(--ink-muted)" }}>
            <span className="font-semibold">메모:</span> {afterparty.description || "없음"}
          </p>
          <div className="mt-2 grid gap-1 text-xs">
            {settlements.length > 0 ? (
              settlements.map((settlement, index) => (
                <div
                  key={settlement.id}
                  className="inline-flex w-fit flex-wrap items-center gap-1 rounded-full border px-2 py-1"
                  style={{ borderColor: "#fed7aa", backgroundColor: "#fff7ed", color: "#9a3412" }}
                >
                  <span className="font-semibold">{`정산${index + 1}`}</span>
                  <span style={{ color: "var(--ink-soft)" }}>
                    {`정산자: ${settlement.settlementManager || "미등록"}`}
                  </span>
                  <span style={{ color: "var(--ink-soft)" }}>
                    {`계좌: ${settlement.settlementAccount || "미등록"}`}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ color: "var(--ink-muted)" }}>정산 정보 없음</span>
            )}
          </div>
        </div>

        <div className="relative z-20 flex min-w-[180px] shrink-0 flex-col items-end gap-2 sm:ml-auto">
          <div className="flex flex-wrap justify-end gap-2">
            <MeetingShareButton
              path={detailPath}
              className="btn-press inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-semibold transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ borderColor: "var(--line)", color: "#0369a1", backgroundColor: "var(--surface)" }}
            />
          </div>
        </div>
      </div>

      <section
        className="mt-4 rounded-xl border p-3"
        style={{ borderColor: "var(--line)", backgroundColor: "rgba(21, 128, 61, 0.04)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#166534" }}>
          참여자
        </p>

        {visibleRoleGroups.length > 0 ? (
          <div className="mt-2 grid gap-1.5">
            {visibleRoleGroups.map((group) => {
              const roleMeta = PARTICIPANT_ROLE_META[group.role];
              return (
                <div
                  key={`${afterparty.id}-participant-role-${group.role}`}
                  className="flex flex-wrap items-start gap-2"
                >
                  <p className="pt-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ color: roleMeta.textColor }}>
                    {roleMeta.label}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {group.rows.map((participant) => (
                      <AfterpartyParticipantChip key={participant.id} participant={participant} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
            등록된 참여자 없음
          </p>
        )}
      </section>
    </article>
  );
}

export default async function AfterpartyPage({ searchParams }: AfterpartyPageProps) {
  const params = await searchParams;
  const requestDate = singleParam(params.date);

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  let selectedDate = isIsoDate(requestDate) ? requestDate : toKstIsoDate(new Date());
  let afterpartiesOnDate: AfterpartySummary[] = [];
  let participantsByAfterparty: Record<string, AfterpartyParticipant[]> = {};
  let settlementsByAfterparty: Record<string, AfterpartySettlement[]> = {};
  const teamLabelByMemberName = new Map<string, string>();
  let loadError = "";

  try {
    const memberPreset = await loadMemberPreset();
    for (const group of memberPreset.teamGroups) {
      const teamLabel = toTeamLabel(group.teamName);
      for (const angel of group.angels) {
        const normalizedAngelName = normalizeMemberName(angel);
        if (teamLabel && !teamLabelByMemberName.has(normalizedAngelName)) {
          teamLabelByMemberName.set(normalizedAngelName, teamLabel);
        }
      }

      for (const memberName of group.members) {
        const normalizedMemberName = normalizeMemberName(memberName);
        if (teamLabel && !teamLabelByMemberName.has(normalizedMemberName)) {
          teamLabelByMemberName.set(normalizedMemberName, teamLabel);
        }
      }
    }
    if (isIsoDate(requestDate)) {
      selectedDate = requestDate;
      afterpartiesOnDate = await listAfterpartiesByDate(selectedDate);
    } else {
      const allAfterparties = await listAfterparties();
      selectedDate = allAfterparties[0]?.eventDate ?? selectedDate;
      afterpartiesOnDate = await listAfterpartiesByDate(selectedDate);
    }
    participantsByAfterparty = await listParticipantsForAfterparties(
      afterpartiesOnDate.map((item) => item.id),
      ""
    );
    settlementsByAfterparty = await listSettlementsForAfterparties(
      afterpartiesOnDate.map((item) => item.id)
    );
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "데이터를 불러오지 못했습니다. DATABASE_URL 설정을 확인해 주세요.";
  }

  const totalSettlementCount = afterpartiesOnDate.reduce(
    (sum, item) => sum + item.settlementCount,
    0
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <DashboardHeader title="뒷풀이 관리" activeTab="afterparty" currentDate={selectedDate} />

      <section className="card-static mb-5 p-5 sm:p-6 fade-in">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="grid gap-2 text-sm sm:min-w-64" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">조회 날짜</span>
            <DatePicker selectedDate={selectedDate} basePath="/afterparty" />
          </label>

          <div className="text-left sm:text-right">
            <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>뒷풀이 요약</h2>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {afterpartiesOnDate.length > 0 ? `${afterpartiesOnDate.length}개 모임` : "모임 없음"}
            </p>
          </div>
        </div>

        {loadError ? (
          <section
            className="mt-4 rounded-xl border p-5 text-sm"
            style={{ borderColor: "#fecaca", backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}
          >
            <h2 className="text-base font-semibold">데이터 로드 실패</h2>
            <p className="mt-2 break-words">{loadError}</p>
          </section>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-2 stagger-children">
            {[
              { label: "모임 수", value: `${afterpartiesOnDate.length}개`, accent: "#c2410c" },
              { label: "정산 수", value: `${totalSettlementCount}개`, accent: "#0369a1" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-stretch overflow-hidden rounded-xl border"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
              >
                <div className="w-1.5 shrink-0" style={{ backgroundColor: item.accent }} />
                <div className="px-3 py-3">
                  <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{item.label}</p>
                  <p className="text-lg font-semibold" style={{ color: "var(--ink)" }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!loadError && afterpartiesOnDate.length === 0 ? (
        <section className="card-static mb-5 p-6 text-center fade-in">
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            선택한 날짜에는 생성된 뒷풀이가 없습니다. 우하단 + 버튼으로 모임을 만들어보세요.
          </p>
        </section>
      ) : null}

      {!loadError && afterpartiesOnDate.length > 0 ? (
        <section className="card-static mb-5 p-5 sm:p-6 fade-in">
          <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>뒷풀이 참여 현황</h3>
          <div className="mt-4 grid gap-4 xl:grid-cols-2 stagger-children">
            {afterpartiesOnDate.map((afterparty) => (
              <AfterpartyCard
                key={afterparty.id}
                afterparty={afterparty}
                settlements={settlementsByAfterparty[afterparty.id] ?? []}
                participants={participantsByAfterparty[afterparty.id] ?? []}
                selectedDate={selectedDate}
                teamLabelByMemberName={teamLabelByMemberName}
              />
            ))}
          </div>
        </section>
      ) : null}

      <CreateAfterpartyModal selectedDate={selectedDate} />
    </main>
  );
}
