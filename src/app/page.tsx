import Link from "next/link";
import {
  createMeetingAction,
  loginAction,
} from "@/app/actions";
import { DatePicker } from "@/app/date-picker";
import { DashboardHeader } from "@/app/dashboard-header";
import { MeetingShareButton } from "@/app/meeting-share-button";
import { OfflineStudyCaptureButton } from "@/app/offline-study-capture-button";
import { OfflineStudyCopyTextButton } from "@/app/offline-study-copy-text-button";
import { isAuthenticated } from "@/lib/auth";
import { toKstIsoDate } from "@/lib/date-utils";
import { extractHttpUrl } from "@/lib/location-utils";
import { normalizeMemberName, toTeamLabel, withTeamLabel } from "@/lib/member-label-utils";
import {
  listMeetings,
  listRsvpsForMeetings,
  type MeetingSummary,
  type ParticipantRole,
  type RsvpRecord,
} from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";
import {
  PARTICIPANT_ROLE_META,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";

type SearchParams = Record<string, string | string[] | undefined>;

type HomePageProps = {
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

function LoginScreen({ authStatus }: { authStatus: string }) {
  const authMessage =
    authStatus === "invalid"
      ? "비밀번호가 맞지 않습니다."
      : authStatus === "required"
        ? "세션이 만료됐습니다."
        : "";

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
    }}>
      <style>{`
        @keyframes li {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .li { animation: li 0.45s ease both; }
        .li-d1 { animation-delay: 60ms; }
        .li-d2 { animation-delay: 120ms; }
        .login-field {
          width: 100%;
          box-sizing: border-box;
          background: transparent;
          border: none;
          border-bottom: 1.5px solid var(--line);
          padding: 0.6rem 0;
          font-size: 15px;
          font-family: inherit;
          color: var(--ink);
          outline: none;
          transition: border-color 0.2s;
        }
        .login-field::placeholder { color: var(--ink-muted); }
        .login-field:focus { border-bottom-color: var(--accent); }
        .login-submit {
          width: 100%;
          height: 46px;
          background: var(--ink);
          color: var(--surface);
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .login-submit:hover { opacity: 0.82; }
        .login-submit:active { transform: scale(0.98); }
      `}</style>

      <div style={{ width: "100%", maxWidth: "340px" }}>
        {/* 브랜드 */}
        <p className="li" style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--accent)",
          margin: "0 0 1.5rem",
        }}>
          Saturday Meetup
        </p>

        {/* 타이틀 */}
        <h1 className="li li-d1" style={{
          fontFamily: "var(--font-instrument-serif), serif",
          fontSize: "2.25rem",
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          color: "var(--ink)",
          margin: "0 0 2.5rem",
        }}>
          모임 대시보드
        </h1>

        {/* 폼 */}
        <form action={loginAction} className="li li-d2" style={{ display: "grid", gap: "1.25rem" }}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label htmlFor="password" style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-muted)",
            }}>
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="공용 비밀번호"
              className="login-field"
              style={authMessage ? { borderBottomColor: "var(--danger)" } : undefined}
            />
            {authMessage ? (
              <p style={{ fontSize: "12px", color: "var(--danger)", margin: 0 }}>
                {authMessage}
              </p>
            ) : null}
          </div>

          <button type="submit" className="login-submit">
            입장하기
          </button>
        </form>
      </div>
    </main>
  );
}

function CreateMeetingModal({ selectedDate }: { selectedDate: string }) {
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
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--ink)" }}>모임 만들기</p>
        <form action={createMeetingAction} className="grid gap-3 md:grid-cols-12">
          <input type="hidden" name="returnDate" value={selectedDate} />

          <label className="grid gap-1 text-sm md:col-span-5" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">모임 이름</span>
            <input
              name="title"
              required
              maxLength={80}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 강남 토요 스터디 A조 + B조"
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">날짜</span>
            <input
              name="meetingDate"
              type="date"
              defaultValue={selectedDate}
              required
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">시작 시간</span>
            <input
              name="startTime"
              type="time"
              defaultValue="14:00"
              required
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-3" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">장소/주소</span>
            <input
              name="location"
              required
              maxLength={160}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 강남역 10번 출구 / https://map.naver.com/..."
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-9" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">설명 (선택)</span>
            <input
              name="description"
              maxLength={240}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 팀별 진행 후 15:00 전체 공유"
            />
          </label>

          <button
            type="submit"
            className="btn-press h-10 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 md:col-span-3 md:self-end"
            style={{ backgroundColor: "var(--success)" }}
          >
            생성
          </button>
        </form>
      </div>
    </details>
  );
}

function UsageGuideModal() {
  return (
    <details className="fixed bottom-24 right-6 z-40">
      <summary
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border text-lg font-bold shadow-lg transition hover:scale-105"
        style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
      >
        ?
      </summary>

      <div
        className="absolute bottom-12 right-0 w-[min(92vw,420px)] rounded-2xl border p-4 shadow-2xl backdrop-blur-md fade-in"
        style={{ borderColor: "var(--line)", backgroundColor: "rgba(255, 253, 249, 0.95)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>사용 가이드</p>
        <ol className="mt-2 grid gap-1 text-xs" style={{ color: "var(--ink-soft)" }}>
          <li>1) 조회 날짜를 선택합니다.</li>
          <li>2) 우하단 + 버튼으로 모임을 생성합니다.</li>
          <li>3) 스터디 카드에서 참여자 현황을 확인합니다.</li>
          <li>4) 카드 클릭으로 상세 화면에 이동해 수정/삭제를 진행합니다.</li>
        </ol>
      </div>
    </details>
  );
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

function ParticipantChip({
  row,
  showNote = true,
  displayName,
}: {
  row: RsvpRecord;
  showNote?: boolean;
  displayName?: string;
}) {
  const hasNote = showNote && Boolean(row.note);
  const participantName = displayName ?? row.name;
  const roleMeta = PARTICIPANT_ROLE_META[row.role];
  const chipStyle = {
    borderColor: roleMeta.borderColor,
    backgroundColor: roleMeta.backgroundColor,
    color: roleMeta.textColor,
  };
  const displayText = `${roleMeta.emoji ? `${roleMeta.emoji} ` : ""}${participantName}`;

  if (!hasNote) {
    return (
      <li
        className="inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium leading-none"
        style={chipStyle}
        data-capture-pill="true"
        data-capture-pill-kind="participant"
      >
        <span
          className="text-xs font-medium leading-none"
          data-capture-pill-text="true"
          data-capture-pill-role={row.role}
        >
          {displayText}
        </span>
      </li>
    );
  }

  return (
    <li
      className="inline-flex min-h-6 items-center gap-1 rounded-full border px-2 leading-none"
      style={chipStyle}
      data-capture-pill="true"
      data-capture-pill-kind="participant"
    >
      <span
        className="text-xs font-medium leading-none"
        data-capture-pill-text="true"
        data-capture-pill-role={row.role}
      >
        {displayText}
      </span>
      {showNote && row.note ? (
        <span
          className="inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-semibold leading-none"
          style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
          data-capture-pill="true"
          data-capture-pill-text="true"
        >
          {row.note}
        </span>
      ) : null}
    </li>
  );
}

function teamOrderFromLabel(teamLabel: string): number {
  const matched = teamLabel.match(/(\d+)\s*팀/);
  if (!matched?.[1]) return Number.POSITIVE_INFINITY;
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function sortRsvpsForRole(
  rows: RsvpRecord[],
  role: ParticipantRole,
  teamLabelByMemberName: Map<string, string>
): RsvpRecord[] {
  const sorted = [...rows];
  if (role === "student") {
    sorted.sort((a, b) => {
      const teamA = teamLabelByMemberName.get(normalizeMemberName(a.name)) ?? "";
      const teamB = teamLabelByMemberName.get(normalizeMemberName(b.name)) ?? "";
      const teamOrderA = teamOrderFromLabel(teamA);
      const teamOrderB = teamOrderFromLabel(teamB);

      if (teamOrderA !== teamOrderB) {
        return teamOrderA - teamOrderB;
      }
      if (teamA !== teamB) {
        return teamA.localeCompare(teamB, "ko");
      }

      return normalizeMemberName(a.name).localeCompare(normalizeMemberName(b.name), "ko");
    });
    return sorted;
  }

  sorted.sort((a, b) =>
    withTeamLabel(a.name, teamLabelByMemberName).localeCompare(
      withTeamLabel(b.name, teamLabelByMemberName),
      "ko"
    )
  );
  return sorted;
}

function MeetingCard({
  meeting,
  rsvps,
  selectedDate,
  teamLabelByMemberName,
}: {
  meeting: MeetingSummary;
  rsvps: RsvpRecord[];
  selectedDate: string;
  teamLabelByMemberName: Map<string, string>;
}) {
  const displayParticipantName = (row: RsvpRecord): string => withTeamLabel(row.name, teamLabelByMemberName);
  const groupedByRole = new Map<ParticipantRole, RsvpRecord[]>();
  for (const role of PARTICIPANT_ROLE_ORDER) {
    groupedByRole.set(role, []);
  }
  for (const row of rsvps) {
    const existing = groupedByRole.get(row.role) ?? [];
    existing.push(row);
    groupedByRole.set(row.role, existing);
  }
  for (const role of PARTICIPANT_ROLE_ORDER) {
    groupedByRole.set(
      role,
      sortRsvpsForRole(groupedByRole.get(role) ?? [], role, teamLabelByMemberName)
    );
  }
  const visibleRoleGroups = PARTICIPANT_ROLE_ORDER.map((role) => ({
    role,
    rows: groupedByRole.get(role) ?? [],
  })).filter((group) => group.rows.length > 0);
  const detailPath = `/meetings/${meeting.id}?date=${selectedDate}`;

  return (
    <article className="card study-card relative p-4 sm:p-5">
      <Link
        href={detailPath}
        aria-label={`${meeting.title} 상세 보기`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2"
        style={{ "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
      >
        <span className="sr-only">{meeting.title} 상세 보기</span>
      </Link>
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{meeting.title}</p>
            <span
              className="inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold leading-none"
              style={{ backgroundColor: "rgba(3, 105, 161, 0.12)", color: "#0369a1" }}
              data-capture-pill="true"
            >
              <span className="inline-block leading-none" data-capture-pill-text="true">
                {formatStartTime(meeting.startTime)}
              </span>
            </span>
          </div>
          <p className="mt-1 break-all text-xs" style={{ color: "var(--ink-soft)" }}>
            <span className="font-semibold">장소:</span> <LocationValue location={meeting.location} />
          </p>
          <p className="mt-1 break-all text-xs" style={{ color: "var(--ink-muted)" }}>
            <span className="font-semibold">메모:</span> {meeting.description || "없음"}
          </p>
        </div>

        <div className="relative z-20 flex min-w-[180px] shrink-0 flex-col items-end gap-2 sm:ml-auto">
          <div className="flex flex-wrap justify-end gap-2">
            <MeetingShareButton
              path={detailPath}
              className="btn-press inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-semibold transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ borderColor: "var(--line)", color: "#0369a1", backgroundColor: "var(--surface)" }}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-1.5">
            {[
              { label: "총참여", value: meeting.totalCount, color: "var(--ink)" },
              { label: "멤버", value: meeting.studentCount, color: "#15803d" },
              { label: "운영진", value: meeting.operationCount, color: "#b45309" },
            ].map((item) => (
              <span
                key={`${meeting.id}-${item.label}`}
                className="inline-flex h-6 items-center justify-center rounded-full border px-2 text-[11px] font-semibold leading-none"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: item.color }}
                data-capture-pill="true"
              >
                <span className="inline-block leading-none" data-capture-pill-text="true">
                  {item.label} {item.value}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <section
          className="rounded-xl border p-3"
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
                    key={`${meeting.id}-role-${group.role}`}
                    className="flex flex-wrap items-start gap-2"
                  >
                    <p className="pt-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ color: roleMeta.textColor }}>
                      {roleMeta.label}
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {group.rows.map((row) => (
                        <ParticipantChip
                          key={`${meeting.id}-${group.role}-${row.id}`}
                          row={row}
                          showNote={false}
                          displayName={displayParticipantName(row)}
                        />
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
      </div>

    </article>
  );
}

function buildOfflineStudyShareText({
  selectedDate,
  meetingsOnDate,
  rsvpsByMeeting,
  teamLabelByMemberName,
}: {
  selectedDate: string;
  meetingsOnDate: MeetingSummary[];
  rsvpsByMeeting: Record<string, RsvpRecord[]>;
  teamLabelByMemberName: Map<string, string>;
}): string {
  const lines: string[] = [];
  lines.push(`오프라인 스터디 공유 (${selectedDate})`);
  lines.push(`모임 ${meetingsOnDate.length}개`);
  lines.push("");

  for (const [index, meeting] of meetingsOnDate.entries()) {
    const rsvps = rsvpsByMeeting[meeting.id] ?? [];

    lines.push(`${index + 1}. ${meeting.title}`);
    lines.push(`- 시간: ${formatStartTime(meeting.startTime)}`);
    lines.push(`- 장소: ${meeting.location}`);
    lines.push(`- 메모: ${meeting.description || "없음"}`);
    lines.push(`- 인원: 총 ${meeting.totalCount}명 (멤버 ${meeting.studentCount}, 운영진 ${meeting.operationCount})`);
    for (const role of PARTICIPANT_ROLE_ORDER) {
      const roleMeta = PARTICIPANT_ROLE_META[role];
      const namesByRole = sortRsvpsForRole(
        rsvps.filter((row) => row.role === role),
        role,
        teamLabelByMemberName
      )
        .map((row) => withTeamLabel(row.name, teamLabelByMemberName));
      lines.push(`- ${roleMeta.label}: ${namesByRole.length > 0 ? namesByRole.join(", ") : "없음"}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

const STAT_CONFIG = [
  { label: "모임 수", suffix: "개", accent: "#c2410c" },
  { label: "총 참여", suffix: "명", accent: "#0369a1" },
  { label: "멤버", suffix: "명", accent: "#15803d" },
  { label: "운영진", suffix: "명", accent: "#b45309" },
] as const;

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const authStatus = singleParam(params.auth);
  const requestDate = singleParam(params.date);

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return <LoginScreen authStatus={authStatus} />;
  }

  let meetings: MeetingSummary[] = [];
  let meetingsOnDate: MeetingSummary[] = [];
  let rsvpsByMeeting: Record<string, RsvpRecord[]> = {};
  let knownMemberCount = 0;
  let assignedKnownMemberCount = 0;
  const teamLabelByMemberName = new Map<string, string>();
  let loadError = "";

  let selectedDate = isIsoDate(requestDate) ? requestDate : toKstIsoDate(new Date());

  try {
    const [fetchedMeetings, memberPreset] = await Promise.all([
      listMeetings(),
      loadMemberPreset(),
    ]);
    meetings = fetchedMeetings;
    if (!isIsoDate(requestDate)) {
      selectedDate = meetings[0]?.meetingDate ?? selectedDate;
    }

    meetingsOnDate = meetings.filter((meeting) => meeting.meetingDate === selectedDate);
    rsvpsByMeeting = await listRsvpsForMeetings(meetingsOnDate.map((meeting) => meeting.id), "");

    const knownMemberNames = new Set<string>();
    for (const group of memberPreset.teamGroups) {
      const teamLabel = toTeamLabel(group.teamName);
      for (const angel of group.angels) {
        const normalizedAngelName = normalizeMemberName(angel);
        knownMemberNames.add(normalizedAngelName);
        if (teamLabel && !teamLabelByMemberName.has(normalizedAngelName)) {
          teamLabelByMemberName.set(normalizedAngelName, teamLabel);
        }
      }
      for (const member of group.members) {
        const normalizedMemberName = normalizeMemberName(member);
        knownMemberNames.add(normalizedMemberName);
        if (teamLabel && !teamLabelByMemberName.has(normalizedMemberName)) {
          teamLabelByMemberName.set(normalizedMemberName, teamLabel);
        }
      }
    }
    for (const angel of memberPreset.fixedAngels) {
      knownMemberNames.add(normalizeMemberName(angel));
    }
    for (const role of ["supporter", "buddy", "mentor", "manager"] as const) {
      for (const member of memberPreset.specialRoles[role]) {
        knownMemberNames.add(normalizeMemberName(member));
      }
    }

    const assignedNames = new Set<string>();
    for (const rows of Object.values(rsvpsByMeeting)) {
      for (const row of rows) {
        assignedNames.add(normalizeMemberName(row.name));
      }
    }

    knownMemberCount = knownMemberNames.size;
    for (const name of knownMemberNames) {
      if (assignedNames.has(name)) {
        assignedKnownMemberCount += 1;
      }
    }
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "데이터를 불러오지 못했습니다. DATABASE_URL 설정을 확인해 주세요.";
  }

  const dayTotalCount = meetingsOnDate.reduce((sum, meeting) => sum + meeting.totalCount, 0);
  const dayStudentCount = meetingsOnDate.reduce((sum, meeting) => sum + meeting.studentCount, 0);
  const dayOperationCount = meetingsOnDate.reduce((sum, meeting) => sum + meeting.operationCount, 0);
  const statValues = [meetingsOnDate.length, dayTotalCount, dayStudentCount, dayOperationCount];
  const memberCoverageRate =
    knownMemberCount > 0
      ? Math.round((assignedKnownMemberCount / knownMemberCount) * 100)
      : 0;
  const shareText =
    !loadError && meetingsOnDate.length > 0
      ? buildOfflineStudyShareText({
          selectedDate,
          meetingsOnDate,
          rsvpsByMeeting,
          teamLabelByMemberName,
        })
      : "";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <DashboardHeader title="오프라인 스터디 대시보드" activeTab="study" currentDate={selectedDate} />

      <section className="card-static mb-5 p-5 sm:p-6 fade-in">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="grid gap-2 text-sm sm:min-w-64" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">조회 날짜</span>
            <DatePicker selectedDate={selectedDate} />
          </label>

          <div className="text-left sm:text-right">
            <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>오프라인 스터디 요약</h2>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {meetingsOnDate.length > 0 ? `${meetingsOnDate.length}개 모임` : "모임 없음"}
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
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
              {STAT_CONFIG.map((stat, index) => (
                <div
                  key={stat.label}
                  className="flex items-stretch overflow-hidden rounded-xl border"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
                >
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: stat.accent }} />
                  <div className="px-3 py-3">
                    <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{stat.label}</p>
                    <p className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                      {statValues[index]}{stat.suffix}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-4 rounded-xl border p-3"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                참여 커버리지
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                등록 멤버 {knownMemberCount}명 중 {assignedKnownMemberCount}명이 오프라인 스터디에 참여했습니다.
              </p>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--surface-alt)" }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(memberCoverageRate, 100))}%`,
                    backgroundColor: "var(--accent)",
                  }}
                />
              </div>
              <p className="mt-1 text-right text-xs font-semibold" style={{ color: "var(--accent)" }}>
                {memberCoverageRate}%
              </p>
            </div>

            {meetingsOnDate.length === 0 ? (
              <p
                className="mt-4 rounded-xl border border-dashed px-3 py-4 text-center text-sm"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
              >
                선택한 날짜에는 생성된 모임이 없습니다.
              </p>
            ) : (
              <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                  오프라인 스터디 목록
                </p>
                <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                  {meetingsOnDate.map((meeting, index) => (
                    <li
                      key={`timeline-${meeting.id}`}
                      className="rounded-xl border px-3 py-2"
                      style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: "rgba(194, 65, 12, 0.15)", color: "var(--accent)" }}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                            {meeting.title}
                          </p>
                          <p className="truncate text-xs" style={{ color: "var(--ink-soft)" }}>
                            장소: <LocationValue location={meeting.location} />
                          </p>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                        {formatStartTime(meeting.startTime)} · 총 {meeting.totalCount}명
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </section>

      {!loadError && meetingsOnDate.length > 0 ? (
        <section id="offline-study-cards-capture" className="card-static mb-5 p-5 sm:p-6 fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>오프라인 스터디 참여 현황</h3>
            <div className="flex flex-wrap items-center gap-2">
              <OfflineStudyCopyTextButton textToCopy={shareText} />
              <OfflineStudyCaptureButton targetId="offline-study-cards-capture" />
            </div>
          </div>
          <div className="mt-4">
            <div className="grid gap-4 xl:grid-cols-2 stagger-children">
              {meetingsOnDate.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  rsvps={rsvpsByMeeting[meeting.id] ?? []}
                  selectedDate={selectedDate}
                  teamLabelByMemberName={teamLabelByMemberName}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <UsageGuideModal />
      <CreateMeetingModal selectedDate={selectedDate} />
    </main>
  );
}
