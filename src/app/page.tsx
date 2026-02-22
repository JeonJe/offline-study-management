import Link from "next/link";
import {
  createMeetingAction,
  loginAction,
} from "@/app/actions";
import { DatePicker } from "@/app/date-picker";
import { DashboardHeader } from "@/app/dashboard-header";
import { isAuthenticated } from "@/lib/auth";
import { listMeetings, listRsvpsForMeetings, type MeetingSummary, type RsvpRecord } from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";

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

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function normalizeMemberName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/^\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function LoginScreen({ authStatus }: { authStatus: string }) {
  const authMessage =
    authStatus === "invalid"
      ? "비밀번호가 맞지 않습니다. 다시 입력해 주세요."
      : authStatus === "required"
        ? "세션이 만료됐습니다. 다시 비밀번호를 입력해 주세요."
        : "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10 sm:px-6">
      <section className="card-static w-full p-6 sm:p-10 fade-in">
        <p className="mb-1 text-sm font-medium tracking-widest" style={{ color: "var(--accent)" }}>
          SATURDAY MEETUP
        </p>
        <h1
          className="text-3xl tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-instrument-serif), serif", color: "var(--ink)" }}
        >
          토요일 모임 대시보드 로그인
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          공용 비밀번호를 입력하면 날짜별 모임과 참여자를 바로 확인할 수 있습니다.
        </p>

        <form action={loginAction} className="mt-8 grid gap-3 sm:max-w-sm">
          <label htmlFor="password" className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
            공용 비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-11 rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2"
            style={{
              borderColor: "var(--line)",
              "--tw-ring-color": "var(--accent)",
            } as React.CSSProperties}
            placeholder="비밀번호를 입력하세요"
          />
          <button
            type="submit"
            className="btn-press mt-1 h-11 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            대시보드 입장
          </button>
        </form>

        {authMessage ? (
          <p
            className="mt-4 rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: "#fecaca", backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}
          >
            {authMessage}
          </p>
        ) : null}
      </section>
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
        <form action={createMeetingAction} className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="returnDate" value={selectedDate} />

          <label className="grid gap-1 text-sm lg:col-span-2" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">모임 이름</span>
            <input
              name="title"
              required
              maxLength={80}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 홍대 이전제 + 다다스터디"
            />
          </label>

          <label className="grid gap-1 text-sm" style={{ color: "var(--ink-soft)" }}>
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

          <label className="grid gap-1 text-sm" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">장소/주소</span>
            <input
              name="location"
              required
              maxLength={160}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 홍대입구역 3번 출구 앞"
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2 lg:col-span-4" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">설명 (선택)</span>
            <input
              name="description"
              maxLength={240}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 3팀 엔젤 + 팀별 스터디 모임"
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
          <li>4) 상세 관리 버튼에서 수정/삭제를 진행합니다.</li>
        </ol>
      </div>
    </details>
  );
}

function ParticipantChip({ row, showNote = true }: { row: RsvpRecord; showNote?: boolean }) {
  return (
    <li
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1"
      style={
        row.role === "angel"
          ? { borderColor: "#fbbf24", backgroundColor: "var(--angel-bg)", color: "#92400e" }
          : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }
      }
    >
      <span className="text-xs font-medium">
        {row.role === "angel" ? "🪽 " : ""}
        {row.name}
      </span>
      {showNote && row.note ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
        >
          {row.note}
        </span>
      ) : null}
    </li>
  );
}

function MeetingCard({ meeting, rsvps, selectedDate }: { meeting: MeetingSummary; rsvps: RsvpRecord[]; selectedDate: string }) {
  const angels = rsvps.filter((row) => row.role === "angel");
  const students = rsvps.filter((row) => row.role === "student");
  const meetingTitleToken = normalizeMemberName(meeting.title);

  const groupedStudentsMap = new Map<string, RsvpRecord[]>();
  const ungroupedStudents: RsvpRecord[] = [];
  for (const student of students) {
    const note = student.note?.trim() ?? "";
    if (note && normalizeMemberName(note) !== meetingTitleToken) {
      const existing = groupedStudentsMap.get(note) ?? [];
      existing.push(student);
      groupedStudentsMap.set(note, existing);
    } else {
      ungroupedStudents.push(student);
    }
  }
  const groupedStudents = Array.from(groupedStudentsMap.entries()).map(([team, members]) => ({
    team,
    members,
  }));

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{meeting.title}</p>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(3, 105, 161, 0.12)", color: "#0369a1" }}
            >
              {formatStartTime(meeting.startTime)}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span className="font-semibold">장소:</span> {meeting.location}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            <span className="font-semibold">메모:</span> {meeting.description || "없음"}
          </p>
        </div>

        <div className="flex min-w-[150px] flex-col items-end gap-2">
          <Link
            href={`/meetings/${meeting.id}?date=${selectedDate}`}
            className="btn-press inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold transition hover:border-stone-400"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
          >
            상세 관리
          </Link>

          <div className="flex flex-wrap justify-end gap-1.5">
            {[
              { label: "총참여", value: meeting.totalCount, color: "var(--ink)" },
              { label: "멤버", value: meeting.studentCount, color: "#15803d" },
              { label: "엔젤", value: meeting.angelCount, color: "#b45309" },
            ].map((item) => (
              <span
                key={`${meeting.id}-${item.label}`}
                className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: item.color }}
              >
                {item.label} {item.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--line)", backgroundColor: "rgba(180, 83, 9, 0.05)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#92400e" }}>
            엔젤 현황
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {angels.map((row) => (
              <ParticipantChip key={`${meeting.id}-angel-${row.id}`} row={row} showNote={false} />
            ))}
            {angels.length === 0 ? (
              <li className="text-xs" style={{ color: "var(--ink-muted)" }}>등록된 엔젤 없음</li>
            ) : null}
          </ul>
        </section>

        <section
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--line)", backgroundColor: "rgba(21, 128, 61, 0.04)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#166534" }}>
            멤버 현황
          </p>

          {groupedStudents.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {groupedStudents.map((group) => (
                <div
                  key={`${meeting.id}-group-${group.team}`}
                  className="rounded-lg border px-2 py-2"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>
                    {group.team}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {group.members.map((row) => (
                      <ParticipantChip key={`${meeting.id}-student-${row.id}`} row={row} showNote={false} />
                    ))}
                  </ul>
                </div>
              ))}

              {ungroupedStudents.length > 0 ? (
                <div
                  className="rounded-lg border px-2 py-2"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>
                    기타
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {ungroupedStudents.map((row) => (
                      <ParticipantChip key={`${meeting.id}-student-extra-${row.id}`} row={row} showNote={false} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {students.map((row) => (
                <ParticipantChip key={`${meeting.id}-student-${row.id}`} row={row} showNote={false} />
              ))}
              {students.length === 0 ? (
                <li className="text-xs" style={{ color: "var(--ink-muted)" }}>등록된 멤버 없음</li>
              ) : null}
            </ul>
          )}
        </section>
      </div>

    </article>
  );
}

const STAT_CONFIG = [
  { label: "모임 수", suffix: "개", accent: "#c2410c" },
  { label: "총 참여", suffix: "명", accent: "#0369a1" },
  { label: "멤버", suffix: "명", accent: "#15803d" },
  { label: "엔젤", suffix: "명", accent: "#b45309" },
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
  let loadError = "";

  let selectedDate = isIsoDate(requestDate) ? requestDate : toIsoDate(new Date());

  try {
    meetings = await listMeetings();
    if (!isIsoDate(requestDate)) {
      selectedDate = meetings[0]?.meetingDate ?? selectedDate;
    }

    meetingsOnDate = meetings.filter((meeting) => meeting.meetingDate === selectedDate);
    rsvpsByMeeting = await listRsvpsForMeetings(meetingsOnDate.map((meeting) => meeting.id), "");
    const memberPreset = await loadMemberPreset();

    const knownMemberNames = new Set<string>();
    for (const group of memberPreset.teamGroups) {
      knownMemberNames.add(normalizeMemberName(group.angel));
      for (const member of group.members) {
        knownMemberNames.add(normalizeMemberName(member));
      }
    }
    for (const angel of memberPreset.fixedAngels) {
      knownMemberNames.add(normalizeMemberName(angel));
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
  const dayAngelCount = meetingsOnDate.reduce((sum, meeting) => sum + meeting.angelCount, 0);
  const statValues = [meetingsOnDate.length, dayTotalCount, dayStudentCount, dayAngelCount];
  const memberCoverageRate =
    knownMemberCount > 0
      ? Math.round((assignedKnownMemberCount / knownMemberCount) * 100)
      : 0;

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
                            {meeting.location}
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
        <section className="card-static mb-5 p-5 sm:p-6 fade-in">
          <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>오프라인 스터디 카드</h3>
          <div className="mt-4 grid gap-4 xl:grid-cols-2 stagger-children">
            {meetingsOnDate.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                rsvps={rsvpsByMeeting[meeting.id] ?? []}
                selectedDate={selectedDate}
              />
            ))}
          </div>
        </section>
      ) : null}

      <UsageGuideModal />
      <CreateMeetingModal selectedDate={selectedDate} />
    </main>
  );
}
