import {
  loginAction,
} from "@/app/actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DatePicker } from "@/app/date-picker";
import { DashboardHeader } from "@/app/dashboard-header";
import { OfflineStudyCaptureButton } from "@/app/offline-study-capture-button";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { isAuthenticatedForUnit } from "@/lib/auth";
import { pickNearestUpcomingIsoDate, toKstIsoDate } from "@/lib/date-utils";
import { extractHttpUrl } from "@/lib/location-utils";
import { normalizeMemberName, toTeamLabel, withTeamLabel } from "@/lib/member-label-utils";
import {
  MIGRATED_OPERATING_UNIT_NAME,
  MIGRATED_OPERATING_UNIT_SLUG,
  type OperatingUnit,
  listOperatingUnits,
} from "@/lib/operating-unit-store";
import {
  type MeetingSummary,
  type ParticipantRole,
  type RsvpRecord,
} from "@/lib/meetup-store";
import type { MeetingKind } from "@/lib/meeting-kind";
import {
  cachedListMeetingsByKind,
  cachedListMeetingsByKindAndDate,
  cachedListRsvpsForMeetings,
  cachedLoadMemberPreset,
} from "@/lib/cached-queries";
import { cleanReturnPath, cohortAwarePath, cohortEntryLoginPath } from "@/lib/cohort-routes";
import { dataLoadErrorMessage } from "@/lib/ui-error-messages";
import {
  PARTICIPANT_ROLE_META,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";
import { compareText } from "@/lib/sort-utils";
import { CreateMeetingModal } from "@/app/meetup-dashboard-create-meeting-modal";

type SearchParams = Record<string, string | string[] | undefined>;

type MeetupDashboardProps = {
  searchParams: Promise<SearchParams>;
  activeTab: "loopPak" | "study";
  title: string;
  basePath: "/" | "/loop-pak";
  captureTargetId: string;
  meetingKind: MeetingKind;
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

function normalizeLeaders(leaders?: string[] | null): string[] {
  if (!Array.isArray(leaders)) return [];
  return leaders
    .filter((leader): leader is string => typeof leader === "string")
    .map((leader) => leader.trim())
    .filter((leader) => leader.length > 0);
}

function LeaderChips({ leaders }: { leaders?: string[] | null }) {
  const normalized = normalizeLeaders(leaders);
  if (normalized.length === 0) {
    return (
      <span
        className="inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold leading-none"
        style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-muted)" }}
      >
        미지정
      </span>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {normalized.map((leader) => (
        <li
          key={`leader-${leader}`}
          className="flex h-7 items-center rounded-full border px-2.5 text-sm font-semibold leading-none"
          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
        >
          {leader}
        </li>
      ))}
    </ul>
  );
}

export async function safeListEntryOperatingUnits(): Promise<EntryOperatingUnit[]> {
  try {
    const units = await listOperatingUnits();
    const activeUnits = units.filter((unit) => unit.isActive);
    if (activeUnits.length > 0) {
      return activeUnits.map(({ slug, name, description }) => ({ slug, name, description }));
    }
  } catch (error) {
    console.error("[entry] 목록 로드 실패:", error);
  }

  return [
    {
      slug: MIGRATED_OPERATING_UNIT_SLUG,
      name: MIGRATED_OPERATING_UNIT_NAME,
      description: null,
    },
  ];
}

type EntryOperatingUnit = Pick<OperatingUnit, "slug" | "name" | "description">;

function AdminLoginModal({ adminAuthStatus }: { adminAuthStatus: string }) {
  const adminAuthMessage =
    adminAuthStatus === "invalid"
      ? "관리자 코드가 맞지 않습니다."
      : "";
  const adminModalOpen = adminAuthStatus === "open" || Boolean(adminAuthMessage);

  return (
    <>
      <style>{`
        .admin-modal {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: rgba(15, 23, 42, 0.42);
          backdrop-filter: blur(10px);
        }
        .admin-modal.is-open {
          display: flex;
        }
        .admin-modal-panel {
          position: relative;
          width: min(100%, 360px);
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 1.25rem;
          padding: 1.35rem;
          box-shadow: 0 24px 56px rgba(15, 23, 42, 0.22);
        }
        .admin-modal-close {
          position: absolute;
          top: 0.8rem;
          right: 0.9rem;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: var(--ink-muted);
          font-size: 22px;
          line-height: 1;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .admin-modal-close:hover {
          background: var(--surface-muted);
          color: var(--ink);
        }
      `}</style>

      <div
        id="admin-login-modal"
        className={`admin-modal${adminModalOpen ? " is-open" : ""}`}
      >
        <div
          className="admin-modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-login-title"
        >
          <Link href="/" className="admin-modal-close" aria-label="전체관리자 로그인 닫기">
            ×
          </Link>
          <h2 id="admin-login-title" style={{
            fontFamily: "var(--font-heading), sans-serif",
            fontSize: "1.25rem",
            lineHeight: 1.2,
            margin: "0 2rem 0.35rem 0",
            color: "var(--ink)",
          }}>
            전체관리자
          </h2>
          <p style={{ margin: "0 0 1rem", color: "var(--ink-muted)", fontSize: "13px" }}>
            기수와 참가자 입장 설정을 관리하기 위한 코드입니다.
          </p>
          <form action={loginAction} className="grid gap-3">
            <input type="hidden" name="authScope" value="admin" />
            <input type="hidden" name="returnPath" value="/admin" />
            <label htmlFor="adminPassword" className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              관리자 코드
              <input
                id="adminPassword"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="관리자 코드 입력"
                className="login-field"
                autoFocus={adminModalOpen}
                style={adminAuthMessage ? { borderColor: "var(--danger)" } : undefined}
              />
            </label>
            {adminAuthMessage ? (
              <p style={{ fontSize: "12px", color: "var(--danger)", margin: 0 }}>
                {adminAuthMessage}
              </p>
            ) : null}
            <PendingSubmitButton
              idleLabel="관리자 입장"
              pendingLabel="확인 중"
              className="login-submit"
            />
          </form>
        </div>
      </div>
    </>
  );
}

export function LoginScreen({
  authStatus,
  adminAuthStatus,
  units,
  selectedUnitSlug,
  returnPath,
}: {
  authStatus: string;
  adminAuthStatus: string;
  units: EntryOperatingUnit[];
  selectedUnitSlug: string;
  returnPath?: string;
}) {
  const authMessage =
    authStatus === "invalid"
      ? "비밀번호가 맞지 않습니다."
      : authStatus === "required"
        ? "세션이 만료됐습니다."
        : "";
  const selectedUnit =
    units.find((unit) => unit.slug === selectedUnitSlug) ?? units[0] ?? {
      slug: MIGRATED_OPERATING_UNIT_SLUG,
      name: MIGRATED_OPERATING_UNIT_NAME,
      description: null,
    };
  const safeLoginReturnPath = returnPath ? cleanReturnPath(returnPath) : cohortAwarePath(selectedUnit.slug, "/");

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
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
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 0.9rem;
          padding: 0.72rem 0.8rem;
          font-size: 15px;
          font-family: inherit;
          color: var(--ink);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-field::placeholder { color: var(--ink-muted); }
        .login-field:focus {
          border-color: rgba(13, 127, 242, 0.4);
          box-shadow: 0 0 0 3px rgba(13, 127, 242, 0.14);
        }
        .login-submit {
          width: 100%;
          height: 48px;
          background: var(--accent);
          color: var(--surface);
          border: none;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
          box-shadow: 0 10px 20px rgba(13, 127, 242, 0.28);
        }
        .login-submit:hover { opacity: 0.9; }
        .login-submit:active { transform: scale(0.98); }
        .login-secondary-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-soft);
          font-size: 13px;
          font-weight: 700;
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 4px;
          transition: opacity 0.15s;
        }
        .login-secondary-link:hover { opacity: 0.8; }
      `}</style>

      <div
        className="card-static li"
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "1.6rem 1.4rem",
          borderRadius: "1.5rem",
        }}
      >
        <h1 className="li li-d1" style={{
          fontFamily: "var(--font-heading), sans-serif",
          fontSize: "2.05rem",
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          color: "var(--ink)",
          margin: "0 0 0.5rem",
        }}>
          LOOPERS MEETUP
        </h1>
        <form action={loginAction} className="li li-d2" style={{ display: "grid", gap: "1.25rem", marginTop: "1.8rem" }}>
          <input type="hidden" name="authScope" value="unit" />
          <input type="hidden" name="selectedUnit" value={selectedUnit.slug} />
          <input type="hidden" name="returnPath" value={safeLoginReturnPath} />
          <section style={{ display: "grid", gap: "0.5rem" }}>
            <span style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-muted)",
              margin: 0,
            }}>
              이름
            </span>
            <div
              className="login-field"
              aria-label="선택한 기수"
            >
              {selectedUnit.name}
              {selectedUnit.description ? ` - ${selectedUnit.description}` : ""}
            </div>
          </section>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label htmlFor="password" style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-muted)",
            }}>
              입장 코드
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="코드 입력"
              className="login-field"
              style={authMessage ? { borderColor: "var(--danger)" } : undefined}
            />
            {authMessage ? (
              <p style={{ fontSize: "12px", color: "var(--danger)", margin: 0 }}>
                {authMessage}
              </p>
            ) : null}
          </div>

          <PendingSubmitButton
            idleLabel="입장"
            pendingLabel="확인 중"
            className="login-submit"
          />
        </form>

        <div className="li li-d2" style={{ marginTop: "1rem", textAlign: "center" }}>
          <Link href="/" className="login-secondary-link">
            처음으로 돌아가기
          </Link>
        </div>
      </div>

      <AdminLoginModal adminAuthStatus={adminAuthStatus} />
    </main>
  );
}

function UnitSelectionScreen({
  units,
  basePath,
  adminAuthStatus,
}: {
  units: EntryOperatingUnit[];
  basePath: "/" | "/loop-pak";
  adminAuthStatus: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <style>{`
        .login-field {
          width: 100%;
          box-sizing: border-box;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 0.9rem;
          padding: 0.72rem 0.8rem;
          font-size: 15px;
          font-family: inherit;
          color: var(--ink);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-field::placeholder { color: var(--ink-muted); }
        .login-field:focus {
          border-color: rgba(13, 127, 242, 0.4);
          box-shadow: 0 0 0 3px rgba(13, 127, 242, 0.14);
        }
        .login-submit {
          width: 100%;
          height: 48px;
          background: var(--accent);
          color: var(--surface);
          border: none;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
          box-shadow: 0 10px 20px rgba(13, 127, 242, 0.28);
        }
        .login-submit:hover { opacity: 0.9; }
        .login-submit:active { transform: scale(0.98); }
      `}</style>
      <section className="w-full">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--ink-muted)" }}>
              LOOPERS MEETUP
            </p>
          </div>
          <Link
            href="/?adminAuth=open"
            className="inline-flex shrink-0 items-center border-b pb-0.5 text-sm font-bold transition hover:opacity-70"
            style={{ borderColor: "var(--ink-muted)", color: "var(--ink-muted)" }}
          >
            전체관리자
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => {
            const returnPath = cohortAwarePath(unit.slug, basePath);
            return (
              <Link
                key={unit.slug}
                href={cohortEntryLoginPath(unit.slug, { returnPath })}
                className="group flex min-h-44 flex-col justify-between rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                style={{ borderColor: "var(--line)" }}
              >
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
                    {unit.name}
                  </h2>
                  <p className="mt-3 line-clamp-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
                    {unit.description || "Loopers Meetup"}
                  </p>
                </div>
                <span
                  className="mt-8 inline-flex h-10 w-fit items-center rounded-full px-4 text-sm font-extrabold text-white transition group-hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  입장하기
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      <AdminLoginModal adminAuthStatus={adminAuthStatus} />
    </main>
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
        className="modal-surface absolute bottom-12 right-0 w-[min(92vw,420px)] p-4 backdrop-blur-md fade-in"
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
        return compareText(teamA, teamB);
      }

      return compareText(normalizeMemberName(a.name), normalizeMemberName(b.name));
    });
    return sorted;
  }

  sorted.sort((a, b) => compareText(
    withTeamLabel(a.name, teamLabelByMemberName),
    withTeamLabel(b.name, teamLabelByMemberName)
  ));
  return sorted;
}

function MeetingCard({
  meeting,
  rsvps,
  selectedDate,
  unitSlug,
  teamLabelByMemberName,
}: {
  meeting: MeetingSummary;
  rsvps: RsvpRecord[];
  selectedDate: string;
  unitSlug: string;
  teamLabelByMemberName: Map<string, string>;
}) {
  const displayParticipantName = (row: RsvpRecord): string => withTeamLabel(row.name, teamLabelByMemberName);
  const confirmedRsvps = rsvps.filter((row) => row.status === "confirmed");
  const waitlistCount = rsvps.filter((row) => row.status === "waitlist").length;
  const groupedByRole = new Map<ParticipantRole, RsvpRecord[]>();
  for (const role of PARTICIPANT_ROLE_ORDER) {
    groupedByRole.set(role, []);
  }
  for (const row of confirmedRsvps) {
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
  const detailPath = cohortAwarePath(unitSlug, `/meetings/${meeting.id}?date=${selectedDate}`);

  return (
    <article className="card study-card relative overflow-hidden p-0">
      <Link
        href={detailPath}
        aria-label={`${meeting.title} 상세 보기`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2"
        style={{ "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
      >
        <span className="sr-only">{meeting.title} 상세 보기</span>
      </Link>
      <div className="flex flex-wrap items-start gap-4 p-4 sm:flex-nowrap sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <p className="text-base font-extrabold leading-6" style={{ color: "var(--ink)" }}>{meeting.title}</p>
            <span
              className="meta-chip meta-chip-strong"
              data-capture-pill="true"
            >
              <span className="inline-block leading-none" data-capture-pill-text="true">
                {formatStartTime(meeting.startTime)}
              </span>
            </span>
            {meeting.hasPassword ? (
              <span
                className="meta-chip"
                style={{ borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#b45309" }}
              >
                비밀번호 설정
              </span>
            ) : null}
          </div>
          <p className="mt-2 break-all text-xs leading-5" style={{ color: "var(--ink-soft)" }}>
            <span className="font-semibold">장소:</span> <LocationValue location={meeting.location} />
          </p>
          <p className="mt-1 break-all text-xs leading-5" style={{ color: "var(--ink-muted)" }}>
            <span className="font-semibold">메모:</span> {meeting.description || "없음"}
          </p>
          <div className="mt-1 flex flex-wrap items-start gap-2 text-xs" style={{ color: "var(--ink-muted)" }}>
            <span className="font-semibold">방장:</span>
            <LeaderChips leaders={meeting.leaders} />
          </div>
        </div>

        <div className="relative z-20 flex min-w-[140px] shrink-0 flex-col items-end gap-2 sm:ml-auto">
          <div className="metric-row justify-end">
            {(meeting.capacity !== null
              ? [
                  { label: "확정", value: `${meeting.totalCount}/${meeting.capacity}`, color: "var(--ink)" },
                  { label: "대기", value: waitlistCount, color: "var(--accent)" },
                  { label: "운영진", value: meeting.operationCount, color: "#1d4ed8" },
                ]
              : [
                  { label: "멤버", value: meeting.studentCount, color: "#15803d" },
                  { label: "운영진", value: meeting.operationCount, color: "#1d4ed8" },
                  { label: "전체 확정", value: meeting.totalCount, color: "var(--ink)" },
                ]).map((item) => (
              <span
                key={`${meeting.id}-${item.label}`}
                className="meta-chip"
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

      <div className="m-4 mt-0 grid gap-3 sm:m-5 sm:mt-0">
        <section
          className="role-list-panel p-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#166534" }}>
            확정 인원
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
              확정된 인원이 없습니다.
            </p>
          )}
        </section>
      </div>

    </article>
  );
}

const STAT_CONFIG = [
  { label: "모임 수", suffix: "개", accent: "var(--accent)" },
  { label: "확정", suffix: "명", accent: "#0369a1" },
  { label: "멤버", suffix: "명", accent: "#15803d" },
  { label: "운영진", suffix: "명", accent: "#1d4ed8" },
] as const;

export async function MeetupDashboard({
  searchParams,
  activeTab,
  title,
  basePath,
  captureTargetId,
  meetingKind,
}: MeetupDashboardProps) {
  const params = await searchParams;
  const adminAuthStatus = singleParam(params.adminAuth);
  const requestDate = singleParam(params.date);
  const selectedUnitSlug = singleParam(params.unit);

  if (!selectedUnitSlug) {
    const units = await safeListEntryOperatingUnits();
    return (
      <UnitSelectionScreen
        units={units}
        basePath={basePath}
        adminAuthStatus={adminAuthStatus}
      />
    );
  }

  const authenticatedForUnit = await isAuthenticatedForUnit(selectedUnitSlug);
  if (!authenticatedForUnit) {
    const fallbackReturnPath = cohortAwarePath(selectedUnitSlug, basePath);
    const returnPath = requestDate
      ? `${fallbackReturnPath}?date=${encodeURIComponent(requestDate)}`
      : fallbackReturnPath;
    redirect(cohortEntryLoginPath(selectedUnitSlug, { auth: "required", returnPath }));
  }

  let meetings: MeetingSummary[] = [];
  let meetingsOnDate: MeetingSummary[] = [];
  let rsvpsByMeeting: Record<string, RsvpRecord[]> = {};
  const teamLabelByMemberName = new Map<string, string>();
  let loadError = "";

  const todayIsoDate = toKstIsoDate(new Date());
  let selectedDate = isIsoDate(requestDate) ? requestDate : todayIsoDate;

  try {
    const hasRequestedDate = isIsoDate(requestDate);
    const [fetchedMeetings, memberPreset] = await Promise.all([
      hasRequestedDate
        ? cachedListMeetingsByKindAndDate(meetingKind, selectedDate, selectedUnitSlug)
        : cachedListMeetingsByKind(meetingKind, selectedUnitSlug),
      cachedLoadMemberPreset(selectedUnitSlug),
    ]);
    meetings = fetchedMeetings;
    if (!hasRequestedDate) {
      selectedDate = pickNearestUpcomingIsoDate(
        meetings.map((meeting) => meeting.meetingDate),
        todayIsoDate
      );
    }

    meetingsOnDate = hasRequestedDate
      ? meetings
      : meetings.filter((meeting) => meeting.meetingDate === selectedDate);
    rsvpsByMeeting = await cachedListRsvpsForMeetings(meetingsOnDate.map((meeting) => meeting.id), "");

    for (const group of memberPreset.teamGroups) {
      const teamLabel = toTeamLabel(group.teamName);
      for (const angel of group.angels) {
        const normalizedAngelName = normalizeMemberName(angel);
        if (teamLabel && !teamLabelByMemberName.has(normalizedAngelName)) {
          teamLabelByMemberName.set(normalizedAngelName, teamLabel);
        }
      }
      for (const member of group.members) {
        const normalizedMemberName = normalizeMemberName(member);
        if (teamLabel && !teamLabelByMemberName.has(normalizedMemberName)) {
          teamLabelByMemberName.set(normalizedMemberName, teamLabel);
        }
      }
    }
  } catch (error) {
    console.error("Failed to load meetup dashboard", {
      name: error instanceof Error ? error.name : "UnknownError",
      uiMessage: dataLoadErrorMessage(error),
    });
    loadError = dataLoadErrorMessage(error);
  }

  const dayTotalCount = meetingsOnDate.reduce((sum, meeting) => sum + meeting.totalCount, 0);
  const dayStudentCount = meetingsOnDate.reduce((sum, meeting) => sum + meeting.studentCount, 0);
  const dayOperationCount = meetingsOnDate.reduce((sum, meeting) => sum + meeting.operationCount, 0);
  const statValues = [meetingsOnDate.length, dayTotalCount, dayStudentCount, dayOperationCount];
  const resolvedBasePath = cohortAwarePath(selectedUnitSlug, basePath);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
      <DashboardHeader title={title} activeTab={activeTab} currentDate={selectedDate} unitSlug={selectedUnitSlug} />
      <section className="app-section mb-5 p-4 sm:p-5 fade-in">
        <div className="section-toolbar px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">날짜</span>
              <div className="min-w-44">
                <DatePicker selectedDate={selectedDate} basePath={resolvedBasePath} />
              </div>
            </label>
            <span className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
              {meetingsOnDate.length > 0 ? `${meetingsOnDate.length}개 모임` : "모임 없음"}
            </span>
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
            <div className="stat-strip mt-4 stagger-children">
              {STAT_CONFIG.map((stat, index) => (
                <div
                  key={stat.label}
                  className="stat-item"
                  style={{ borderLeftColor: stat.accent }}
                >
                  <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{stat.label}</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: "var(--ink)" }}>
                    <span style={{ color: stat.accent }}>{statValues[index]}</span>{stat.suffix}
                  </p>
                </div>
              ))}
            </div>

            {meetingsOnDate.length === 0 ? (
              <p
                className="mt-4 rounded-xl border border-dashed px-3 py-4 text-center text-sm"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
              >
                선택한 날짜에는 생성된 모임이 없습니다.
              </p>
            ) : null}
          </>
        )}
      </section>

      {!loadError && meetingsOnDate.length > 0 ? (
        <section id={captureTargetId} className="app-section mb-5 p-4 sm:p-5 fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>참여 현황</h3>
            <div className="flex flex-wrap items-center gap-2">
              <OfflineStudyCaptureButton targetId={captureTargetId} />
            </div>
          </div>
          <div className="mt-4">
            <div className="grid gap-3 xl:grid-cols-2 stagger-children">
              {meetingsOnDate.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  rsvps={rsvpsByMeeting[meeting.id] ?? []}
                  selectedDate={selectedDate}
                  unitSlug={selectedUnitSlug}
                  teamLabelByMemberName={teamLabelByMemberName}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <UsageGuideModal />
      <CreateMeetingModal
        selectedDate={selectedDate}
        returnPath={`${resolvedBasePath}?date=${encodeURIComponent(selectedDate)}`}
        meetingKind={meetingKind}
        unitSlug={selectedUnitSlug}
      />
    </main>
  );
}
