import Link from "next/link";
import {
  createMeetingAction,
  loginAction,
} from "@/app/actions";
import { DatePicker } from "@/app/date-picker";
import { DashboardHeader } from "@/app/dashboard-header";
import { LeaderChipInput } from "@/app/leader-chip-input";
import { OfflineStudyCaptureButton } from "@/app/offline-study-capture-button";
import { OfflineStudyCopyTextButton } from "@/app/offline-study-copy-text-button";
import { isAuthenticated } from "@/lib/auth";
import { pickNearestUpcomingIsoDate, toKstIsoDate } from "@/lib/date-utils";
import { extractHttpUrl } from "@/lib/location-utils";
import { normalizeMemberName, toTeamLabel, withTeamLabel } from "@/lib/member-label-utils";
import {
  DEFAULT_OPERATING_UNIT_NAME,
  DEFAULT_OPERATING_UNIT_SLUG,
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
  cachedListRsvpsForMeetings,
  cachedLoadMemberPreset,
} from "@/lib/cached-queries";
import { cohortAwarePath } from "@/lib/cohort-routes";
import { dataLoadErrorMessage } from "@/lib/ui-error-messages";
import {
  PARTICIPANT_ROLE_META,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";
import { buildOfflineStudyShareText } from "@/lib/share-text";

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

type EntryOperatingUnit = Pick<OperatingUnit, "slug" | "name" | "description">;

async function safeListEntryOperatingUnits(): Promise<EntryOperatingUnit[]> {
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
      slug: DEFAULT_OPERATING_UNIT_SLUG,
      name: DEFAULT_OPERATING_UNIT_NAME,
      description: null,
    },
  ];
}

function LoginScreen({
  authStatus,
  adminAuthStatus,
  units,
  selectedUnitSlug,
}: {
  authStatus: string;
  adminAuthStatus: string;
  units: EntryOperatingUnit[];
  selectedUnitSlug: string;
}) {
  const authMessage =
    authStatus === "invalid"
      ? "비밀번호가 맞지 않습니다."
      : authStatus === "required"
        ? "세션이 만료됐습니다."
        : "";
  const adminAuthMessage =
    adminAuthStatus === "invalid"
      ? "관리자 코드가 맞지 않습니다."
      : "";
  const selectedUnit =
    units.find((unit) => unit.slug === selectedUnitSlug) ?? units[0] ?? {
      slug: DEFAULT_OPERATING_UNIT_SLUG,
      name: DEFAULT_OPERATING_UNIT_NAME,
      description: null,
    };

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
        .admin-entry-link {
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
        .admin-entry-link:hover { opacity: 0.8; }
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
        .admin-modal:target,
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
        className="card-static li"
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "1.6rem 1.4rem",
          borderRadius: "1.5rem",
        }}
      >
        {/* 타이틀 */}
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
        <p className="li li-d1" style={{ margin: "0 0 1.8rem", color: "var(--ink-muted)", fontSize: "13px" }}>
          이름을 선택하고 입장하세요.
        </p>

        {/* 폼 */}
        <form action={loginAction} className="li li-d2" style={{ display: "grid", gap: "1.25rem" }}>
          <input type="hidden" name="authScope" value="unit" />
          <section style={{ display: "grid", gap: "0.5rem" }}>
            <label htmlFor="selectedUnit" style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-muted)",
              margin: 0,
            }}>
              이름
            </label>
            <select
              id="selectedUnit"
              name="selectedUnit"
              defaultValue={selectedUnit.slug}
              className="login-field"
              required
            >
              {units.map((unit) => (
                <option key={unit.slug} value={unit.slug}>
                  {unit.name}
                  {unit.description ? ` - ${unit.description}` : ""}
                </option>
              ))}
            </select>
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

          <button type="submit" className="login-submit">
            입장
          </button>
        </form>

        <div className="li li-d2" style={{ marginTop: "1rem", textAlign: "center" }}>
          <a href="#admin-login-modal" className="admin-entry-link">
            전체 관리자
          </a>
        </div>
      </div>

      <div
        id="admin-login-modal"
        className={`admin-modal${adminAuthMessage ? " is-open" : ""}`}
      >
        <div
          className="admin-modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-login-title"
        >
          <a href="#" className="admin-modal-close" aria-label="전체 관리자 로그인 닫기">
            ×
          </a>
          <h2 id="admin-login-title" style={{
            fontFamily: "var(--font-heading), sans-serif",
            fontSize: "1.25rem",
            lineHeight: 1.2,
            margin: "0 2rem 0.35rem 0",
            color: "var(--ink)",
          }}>
            전체 관리자
          </h2>
          <p style={{ margin: "0 0 1rem", color: "var(--ink-muted)", fontSize: "13px" }}>
            목록 생성과 전체 설정 관리를 위한 코드입니다.
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
                autoFocus={Boolean(adminAuthMessage)}
                style={adminAuthMessage ? { borderColor: "var(--danger)" } : undefined}
              />
            </label>
            {adminAuthMessage ? (
              <p style={{ fontSize: "12px", color: "var(--danger)", margin: 0 }}>
                {adminAuthMessage}
              </p>
            ) : null}
            <button type="submit" className="login-submit">
              관리자 입장
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function UnitSelectionScreen({
  units,
  basePath,
}: {
  units: EntryOperatingUnit[];
  basePath: "/" | "/loop-pak";
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="w-full rounded-[1.5rem] border bg-white p-4 shadow-sm sm:p-6" style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--line)" }}>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--ink-muted)" }}>
              LOOPERS MEETUP
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: "var(--ink)" }}>
              들어갈 목록을 선택하세요
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              선택한 목록의 루프팩, 스터디, 뒷풀이, 멤버, 엔젤, 관리자 화면으로 이동합니다.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-10 shrink-0 items-center rounded-xl border px-3 text-sm font-bold"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
          >
            전체 관리자
          </Link>
        </div>

        <div className="mt-4 max-h-[62vh] overflow-y-auto pr-1">
          <div className="grid gap-2">
            {units.map((unit) => (
              <Link
                key={unit.slug}
                href={cohortAwarePath(unit.slug, basePath)}
                className="group flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                style={{ borderColor: "var(--line)" }}
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold" style={{ color: "var(--ink)" }}>
                    {unit.name}
                  </h2>
                  <p className="mt-1 truncate text-sm" style={{ color: "var(--ink-muted)" }}>
                    {unit.description || "루프팩, 스터디, 뒷풀이 관리"}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition group-hover:border-transparent"
                  style={{ borderColor: "rgba(13, 127, 242, 0.24)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
                >
                  입장
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function CreateMeetingModal({
  selectedDate,
  returnPath,
  meetingKind,
}: {
  selectedDate: string;
  returnPath: string;
  meetingKind: MeetingKind;
}) {
  return (
    <details className="fixed bottom-6 right-6 z-40">
      <summary
        className="fab-pulse flex h-14 w-14 cursor-pointer list-none items-center justify-center rounded-full text-2xl font-semibold text-white shadow-lg transition hover:scale-105"
        style={{ backgroundColor: "var(--accent)", boxShadow: "0 16px 30px rgba(13, 127, 242, 0.35)" }}
      >
        +
      </summary>

      <div
        className="absolute bottom-18 right-0 w-[min(92vw,760px)] rounded-[1.75rem] border p-4 shadow-2xl backdrop-blur-md fade-in"
        style={{ borderColor: "var(--line)", backgroundColor: "rgba(255, 255, 255, 0.95)" }}
      >
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--ink)" }}>모임 만들기</p>
        <form action={createMeetingAction} className="grid gap-3 md:grid-cols-12">
          <input type="hidden" name="returnDate" value={selectedDate} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input type="hidden" name="meetingKind" value={meetingKind} />

          <section
            className="grid gap-3 rounded-[1.25rem] border p-3 md:col-span-12 md:grid-cols-12"
            style={{ borderColor: "var(--line)", backgroundColor: "rgba(255, 255, 255, 0.72)" }}
          >
            <label className="grid gap-1 text-sm md:col-span-8" style={{ color: "var(--ink-soft)" }}>
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

            <label className="grid gap-1 text-sm md:col-span-4" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">비밀번호 (선택)</span>
              <input
                name="meetingPassword"
                type="password"
                maxLength={80}
                autoComplete="new-password"
                className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
                style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
                placeholder="비워두면 누구나 수정할 수 있어요"
              />
            </label>

            <label className="grid gap-1 text-sm md:col-span-12" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">방장</span>
              <LeaderChipInput
                name="leaders"
                placeholder="방장 이름 입력"
              />
            </label>
          </section>

          <section
            className="grid gap-3 rounded-[1.25rem] border p-3 md:col-span-12 md:grid-cols-12"
            style={{ borderColor: "var(--line)", backgroundColor: "rgba(255, 255, 255, 0.72)" }}
          >
            <label className="grid gap-1 text-sm md:col-span-3" style={{ color: "var(--ink-soft)" }}>
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

            <label className="grid gap-1 text-sm md:col-span-3" style={{ color: "var(--ink-soft)" }}>
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

            <label className="grid gap-1 text-sm md:col-span-6" style={{ color: "var(--ink-soft)" }}>
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
          </section>

          <label className="grid gap-1 text-sm md:col-span-12" style={{ color: "var(--ink-soft)" }}>
            <span className="font-medium">설명 (선택)</span>
            <input
              name="description"
              maxLength={240}
              className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
              style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
              placeholder="예: 팀별 진행 후 15:00 전체 정리"
            />
          </label>

          <button
            type="submit"
            className="btn-press h-10 rounded-full px-4 text-sm font-semibold text-white transition hover:opacity-90 md:col-span-12"
            style={{ backgroundColor: "var(--accent)", boxShadow: "0 10px 20px rgba(13, 127, 242, 0.25)" }}
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
        className="absolute bottom-12 right-0 w-[min(92vw,420px)] rounded-[1.5rem] border p-4 shadow-2xl backdrop-blur-md fade-in"
        style={{ borderColor: "var(--line)", backgroundColor: "rgba(255, 255, 255, 0.95)" }}
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
            {[
              { label: "총참여", value: meeting.totalCount, color: "var(--ink)" },
              { label: "멤버", value: meeting.studentCount, color: "#15803d" },
              { label: "운영진", value: meeting.operationCount, color: "#1d4ed8" },
            ].map((item) => (
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

const STAT_CONFIG = [
  { label: "모임 수", suffix: "개", accent: "var(--accent)" },
  { label: "총 참여", suffix: "명", accent: "#0369a1" },
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
  const authStatus = singleParam(params.auth);
  const adminAuthStatus = singleParam(params.adminAuth);
  const requestDate = singleParam(params.date);
  const selectedUnitSlug = singleParam(params.unit);

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    const units = await safeListEntryOperatingUnits();
    return (
      <LoginScreen
        authStatus={authStatus}
        adminAuthStatus={adminAuthStatus}
        units={units}
        selectedUnitSlug={selectedUnitSlug}
      />
    );
  }

  if (!selectedUnitSlug) {
    const units = await safeListEntryOperatingUnits();
    return <UnitSelectionScreen units={units} basePath={basePath} />;
  }

  let meetings: MeetingSummary[] = [];
  let meetingsOnDate: MeetingSummary[] = [];
  let rsvpsByMeeting: Record<string, RsvpRecord[]> = {};
  const teamLabelByMemberName = new Map<string, string>();
  let loadError = "";

  const todayIsoDate = toKstIsoDate(new Date());
  let selectedDate = isIsoDate(requestDate) ? requestDate : todayIsoDate;

  try {
    const [fetchedMeetings, memberPreset] = await Promise.all([
      cachedListMeetingsByKind(meetingKind),
      cachedLoadMemberPreset(),
    ]);
    meetings = fetchedMeetings;
    if (!isIsoDate(requestDate)) {
      selectedDate = pickNearestUpcomingIsoDate(
        meetings.map((meeting) => meeting.meetingDate),
        todayIsoDate
      );
    }

    meetingsOnDate = meetings.filter((meeting) => meeting.meetingDate === selectedDate);
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
  const shareText =
    !loadError && meetingsOnDate.length > 0
      ? buildOfflineStudyShareText({
          selectedDate,
          meetingsOnDate,
          rsvpsByMeeting,
          teamLabelByMemberName,
        })
      : "";
  const resolvedBasePath = cohortAwarePath(selectedUnitSlug, basePath);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
      <DashboardHeader title={title} activeTab={activeTab} currentDate={selectedDate} unitSlug={selectedUnitSlug} />

      <section className="card-static mb-5 p-4 sm:p-5 fade-in">
        <div className="rounded-xl border px-3 py-3 sm:px-4" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
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
            <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>요약</h2>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
              {STAT_CONFIG.map((stat, index) => (
                <div
                  key={stat.label}
                  className="rounded-xl border p-3"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
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
        <section id={captureTargetId} className="card-static mb-5 p-4 sm:p-5 fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>참여 현황</h3>
            <div className="flex flex-wrap items-center gap-2">
              <OfflineStudyCopyTextButton textToCopy={shareText} linkPath={`${resolvedBasePath}?date=${encodeURIComponent(selectedDate)}`} />
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
      />
    </main>
  );
}
