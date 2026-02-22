import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createAfterpartyAction,
} from "@/app/actions";
import { DatePicker } from "@/app/date-picker";
import { DashboardHeader } from "@/app/dashboard-header";
import { isAuthenticated } from "@/lib/auth";
import {
  listAfterparties,
  listParticipantsForAfterparties,
  type AfterpartyParticipant,
  type AfterpartySummary,
} from "@/lib/afterparty-store";

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
  participants,
  selectedDate,
}: {
  afterparty: AfterpartySummary;
  participants: AfterpartyParticipant[];
  selectedDate: string;
}) {
  return (
    <article id={`afterparty-${afterparty.id}`} className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{afterparty.title}</p>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(3, 105, 161, 0.12)", color: "#0369a1" }}
            >
              {formatStartTime(afterparty.startTime)}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span className="font-semibold">장소:</span> {afterparty.location}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            <span className="font-semibold">메모:</span> {afterparty.description || "없음"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded-full border px-2 py-1"
              style={{ borderColor: "#86efac", backgroundColor: "#ecfdf3", color: "#166534" }}
            >
              정산자: {afterparty.settlementManager || "미등록"}
            </span>
            <span
              className="rounded-full border px-2 py-1"
              style={{ borderColor: "#7dd3fc", backgroundColor: "#f0f9ff", color: "#0c4a6e" }}
            >
              계좌: {afterparty.settlementAccount || "미등록"}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/afterparty/${afterparty.id}?date=${selectedDate}`}
            className="btn-press rounded-lg border px-2 py-1 text-[11px] font-semibold"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
          >
            상세 관리
          </Link>
        </div>
      </div>

      <section
        className="mt-4 rounded-xl border p-3"
        style={{ borderColor: "var(--line)", backgroundColor: "rgba(21, 128, 61, 0.04)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#166534" }}>
            참여자
          </p>
          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{afterparty.participantCount}명</span>
        </div>

        <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
          {afterparty.participantCount === 0 ? "없음" : `${afterparty.participantCount}명`}
        </p>

        {participants.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
              >
                {participant.name}
              </li>
            ))}
          </ul>
        ) : null}
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

  let selectedDate = isIsoDate(requestDate) ? requestDate : toIsoDate(new Date());
  let afterparties: AfterpartySummary[] = [];
  let afterpartiesOnDate: AfterpartySummary[] = [];
  let participantsByAfterparty: Record<string, AfterpartyParticipant[]> = {};
  let loadError = "";

  try {
    afterparties = await listAfterparties();
    if (!isIsoDate(requestDate)) {
      selectedDate = afterparties[0]?.eventDate ?? selectedDate;
    }

    afterpartiesOnDate = afterparties.filter((item) => item.eventDate === selectedDate);
    participantsByAfterparty = await listParticipantsForAfterparties(
      afterpartiesOnDate.map((item) => item.id),
      ""
    );
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "데이터를 불러오지 못했습니다. DATABASE_URL 설정을 확인해 주세요.";
  }

  const totalParticipantCount = afterpartiesOnDate.reduce(
    (sum, item) => sum + item.participantCount,
    0
  );
  const settledParticipantCount = Object.values(participantsByAfterparty)
    .flat()
    .filter((row) => row.isSettled).length;
  const unsettledParticipantCount = Math.max(
    0,
    totalParticipantCount - settledParticipantCount
  );
  const settlementRate =
    totalParticipantCount > 0
      ? `${Math.round((settledParticipantCount / totalParticipantCount) * 100)}%`
      : "0%";

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
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
            {[
              { label: "모임 수", value: `${afterpartiesOnDate.length}개`, accent: "#c2410c" },
              { label: "총 참여", value: `${totalParticipantCount}명`, accent: "#0369a1" },
              { label: "미정산 인원", value: `${unsettledParticipantCount}명`, accent: "#b45309" },
              { label: "정산 완료율", value: settlementRate, accent: "#15803d" },
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
          <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>뒷풀이 카드</h3>
          <div className="mt-4 grid gap-4 xl:grid-cols-2 stagger-children">
            {afterpartiesOnDate.map((afterparty) => (
              <AfterpartyCard
                key={afterparty.id}
                afterparty={afterparty}
                participants={participantsByAfterparty[afterparty.id] ?? []}
                selectedDate={selectedDate}
              />
            ))}
          </div>
        </section>
      ) : null}

      <CreateAfterpartyModal selectedDate={selectedDate} />
    </main>
  );
}
