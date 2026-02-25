import Link from "next/link";
import { redirect } from "next/navigation";
import {
  bulkCreateAfterpartyParticipantsAction,
  deleteAfterpartyAction,
  deleteAfterpartyParticipantAction,
  updateAfterpartyAction,
} from "@/app/actions";
import { isAuthenticated } from "@/lib/auth";
import { loadMemberPreset } from "@/lib/member-store";
import {
  listAfterparties,
  listParticipantsForAfterparties,
  type AfterpartyParticipant,
} from "@/lib/afterparty-store";
import { EditManageModal } from "@/app/meetings/[meetingId]/edit-manage-modal";
import { listMeetings, listRsvpsForMeetings } from "@/lib/meetup-store";
import { SettlementToggle } from "@/app/afterparty/[afterpartyId]/settlement-toggle";

type PageProps = {
  params: Promise<{ afterpartyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeName(value: string): string {
  return value
    .replace(/\([^)]*\)/g, "")
    .replace(/^\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

function addAssignment(
  map: Map<string, { title: string; kind: "study" | "afterparty" }[]>,
  normalizedName: string,
  title: string,
  kind: "study" | "afterparty"
): void {
  const existing = map.get(normalizedName) ?? [];
  if (!existing.some((item) => item.title === title && item.kind === kind)) {
    existing.push({ title, kind });
  }
  map.set(normalizedName, existing);
}

function QuickAddButton({
  afterpartyId,
  returnDate,
  returnPath,
  name,
  accent,
}: {
  afterpartyId: string;
  returnDate: string;
  returnPath: string;
  name: string;
  accent?: boolean;
}) {
  return (
    <form action={bulkCreateAfterpartyParticipantsAction} className="inline">
      <input type="hidden" name="afterpartyId" value={afterpartyId} />
      <input type="hidden" name="returnDate" value={returnDate} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <input type="hidden" name="names" value={name} />
      <button
        type="submit"
        className="underline-offset-2 hover:underline"
        style={{ color: accent ? "var(--angel)" : "var(--ink-soft)" }}
      >
        {accent ? `🪽 ${name}` : name}
      </button>
    </form>
  );
}

function ParticipantRow({
  row,
  afterpartyId,
  returnDate,
  returnPath,
}: {
  row: AfterpartyParticipant;
  afterpartyId: string;
  returnDate: string;
  returnPath: string;
}) {
  return (
    <li
      className="rounded-lg border bg-white px-2 py-2"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>{row.name}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <SettlementToggle
            afterpartyId={afterpartyId}
            participantId={row.id}
            isSettled={row.isSettled}
          />

          <form action={deleteAfterpartyParticipantAction}>
            <input type="hidden" name="afterpartyId" value={afterpartyId} />
            <input type="hidden" name="participantId" value={row.id} />
            <input type="hidden" name="returnDate" value={returnDate} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="btn-press rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{ borderColor: "#fecaca", color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
            >
              삭제
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

export default async function AfterpartyDetailPage({ params, searchParams }: PageProps) {
  const { afterpartyId } = await params;
  const query = await searchParams;
  const date = singleParam(query.date);
  const teamFilter = singleParam(query.team);

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [afterparties, participantsByAfterparty, memberPreset, allMeetingsRaw] = await Promise.all([
    listAfterparties(),
    listParticipantsForAfterparties([afterpartyId], ""),
    loadMemberPreset(),
    listMeetings(),
  ]);

  const afterparty = afterparties.find((item) => item.id === afterpartyId);
  if (!afterparty) {
    redirect(date ? `/afterparty?date=${date}` : "/afterparty");
  }

  const participants = participantsByAfterparty[afterpartyId] ?? [];
  const settledCount = participants.filter((row) => row.isSettled).length;
  const assignmentByName = new Map<string, { title: string; kind: "study" | "afterparty" }[]>();

  const sameDateAfterparties = afterparties.filter(
    (item) => item.eventDate === afterparty.eventDate
  );
  const allMeetings = allMeetingsRaw.filter(
    (item) => item.meetingDate === afterparty.eventDate
  );

  const [participantsByAllAfterparty, rsvpsByMeeting] = await Promise.all([
    listParticipantsForAfterparties(sameDateAfterparties.map((item) => item.id), ""),
    listRsvpsForMeetings(allMeetings.map((item) => item.id), ""),
  ]);

  for (const row of sameDateAfterparties) {
    const names = participantsByAllAfterparty[row.id] ?? [];
    for (const participant of names) {
      addAssignment(assignmentByName, normalizeName(participant.name), row.title, "afterparty");
    }
  }

  for (const meeting of allMeetings) {
    const rows = rsvpsByMeeting[meeting.id] ?? [];
    for (const row of rows) {
      addAssignment(assignmentByName, normalizeName(row.name), meeting.title, "study");
    }
  }

  const currentAfterpartyNames = new Set(participants.map((row) => normalizeName(row.name)));

  const visibleTeamGroups = teamFilter
    ? memberPreset.teamGroups.filter((team) => team.teamName === teamFilter)
    : memberPreset.teamGroups;

  const totalAssignableCount = visibleTeamGroups.reduce(
    (sum, team) => sum + team.members.length + 1,
    0
  );
  const assignedCount = visibleTeamGroups.reduce((sum, team) => {
    const membersAssigned = team.members.filter((name) => currentAfterpartyNames.has(normalizeName(name))).length;
    const angelAssigned = currentAfterpartyNames.has(normalizeName(team.angel)) ? 1 : 0;
    return sum + membersAssigned + angelAssigned;
  }, 0);
  const assignRate = totalAssignableCount > 0 ? Math.round((assignedCount / totalAssignableCount) * 100) : 0;

  const returnParams = new URLSearchParams();
  if (date) returnParams.set("date", date);
  if (teamFilter) returnParams.set("team", teamFilter);
  const returnQuery = returnParams.toString();
  const returnPath = `/afterparty/${afterpartyId}${returnQuery ? `?${returnQuery}` : ""}`;
  const backPath = date ? `/afterparty?date=${date}` : "/afterparty";

  function teamFilterHref(teamName?: string): string {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (teamName) params.set("team", teamName);
    const queryText = params.toString();
    return `/afterparty/${afterpartyId}${queryText ? `?${queryText}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mb-4">
        <Link href={backPath} className="text-sm font-semibold hover:underline" style={{ color: "var(--accent)" }}>
          ← 뒷풀이 보드로 돌아가기
        </Link>
      </div>

      <section className="card-static p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl tracking-tight" style={{ fontFamily: "var(--font-instrument-serif), serif", color: "var(--ink)" }}>
              {afterparty.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
              {afterparty.location} · {formatStartTime(afterparty.startTime)}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
              현재 참여자 {participants.length}명
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

          <EditManageModal>
            <section
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
            >
              <h3 className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>뒷풀이 정보 수정</h3>
              <form action={updateAfterpartyAction} className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <input type="hidden" name="afterpartyId" value={afterparty.id} />
                <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <input name="title" required defaultValue={afterparty.title} className="h-10 rounded-lg border bg-white px-3" style={{ borderColor: "var(--line)" }} />
                <input name="location" required defaultValue={afterparty.location} className="h-10 rounded-lg border bg-white px-3" style={{ borderColor: "var(--line)" }} />
                <input name="eventDate" type="date" required defaultValue={afterparty.eventDate} className="h-10 rounded-lg border bg-white px-3" style={{ borderColor: "var(--line)" }} />
                <input name="startTime" type="time" required defaultValue={afterparty.startTime} className="h-10 rounded-lg border bg-white px-3" style={{ borderColor: "var(--line)" }} />
                <input name="settlementManager" defaultValue={afterparty.settlementManager ?? ""} className="h-10 rounded-lg border bg-white px-3" style={{ borderColor: "var(--line)" }} placeholder="정산자 이름" />
                <input name="settlementAccount" defaultValue={afterparty.settlementAccount ?? ""} className="h-10 rounded-lg border bg-white px-3" style={{ borderColor: "var(--line)" }} placeholder="계좌번호" />
                <input name="description" defaultValue={afterparty.description ?? ""} className="h-10 rounded-lg border bg-white px-3 md:col-span-2" style={{ borderColor: "var(--line)" }} placeholder="메모" />
                <button type="submit" className="btn-press h-10 rounded-lg text-sm font-semibold text-white md:w-28" style={{ backgroundColor: "var(--ink)" }}>
                  정보 저장
                </button>
              </form>
            </section>

            <section
              className="mt-4 rounded-xl border p-4"
              style={{ borderColor: "#fecaca", backgroundColor: "var(--danger-bg)" }}
            >
              <h3 className="text-xs font-semibold" style={{ color: "var(--danger)" }}>모임 삭제</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                이 뒷풀이와 참여자 데이터가 함께 삭제됩니다.
              </p>
              <form action={deleteAfterpartyAction} className="mt-3">
                <input type="hidden" name="afterpartyId" value={afterparty.id} />
                <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                <button
                  type="submit"
                  className="btn-press h-9 rounded-lg px-3 text-xs font-semibold text-white"
                  style={{ backgroundColor: "var(--danger)" }}
                >
                  이 뒷풀이 삭제
                </button>
              </form>
            </section>
          </EditManageModal>
        </div>
      </section>

      <section className="mt-4 card-static p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>참여자 관리</h2>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{participants.length}명</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}
            >
              정산 {settledCount}/{participants.length}
            </span>
          </div>
        </div>

        <form action={bulkCreateAfterpartyParticipantsAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="afterpartyId" value={afterparty.id} />
          <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input
            name="names"
            className="h-9 w-full rounded-lg border bg-white px-2 text-xs sm:w-80"
            style={{ borderColor: "var(--line)" }}
            placeholder="이름 또는 이름,이름"
          />
          <button type="submit" className="btn-press h-9 rounded-lg border px-2 text-xs font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            참여자 추가
          </button>
        </form>

        <ul className="mt-3 grid gap-1.5">
          {participants.map((row) => (
            <ParticipantRow
              key={row.id}
              row={row}
              afterpartyId={afterparty.id}
              returnDate={date || afterparty.eventDate}
              returnPath={returnPath}
            />
          ))}
          {participants.length === 0 ? <li className="text-xs" style={{ color: "var(--ink-muted)" }}>등록된 참여자 없음</li> : null}
        </ul>
      </section>

      <section className="mt-4 card-static p-4 fade-in">
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>팀 기반 빠른 추가</h2>
        <p className="mt-2 rounded-lg border border-dashed px-2.5 py-2 text-[11px]" style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}>
          이름을 클릭하면 뒷풀이 참여자로 즉시 추가됩니다. 오른쪽 뱃지로 현재 추가 여부를 확인하세요.
        </p>

        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--ink-soft)" }}>
            <span>{assignRate}% 추가됨</span>
            <span>{assignedCount}/{totalAssignableCount}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-alt)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${assignRate}%`, backgroundColor: assignRate === 100 ? "var(--success)" : "var(--accent)" }} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          <Link
            href={teamFilterHref()}
            className="btn-press rounded-full border px-2 py-1 text-[11px] font-semibold transition"
            style={!teamFilter ? { borderColor: "var(--accent)", backgroundColor: "rgba(194, 65, 12, 0.1)", color: "var(--accent)" } : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
          >
            전체
          </Link>
          {memberPreset.teamGroups.map((team) => (
            <Link
              key={`filter-${team.teamName}`}
              href={teamFilterHref(team.teamName)}
              className="btn-press rounded-full border px-2 py-1 text-[11px] font-semibold transition"
              style={teamFilter === team.teamName ? { borderColor: "var(--accent)", backgroundColor: "rgba(194, 65, 12, 0.1)", color: "var(--accent)" } : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
            >
              {team.teamName}
            </Link>
          ))}
        </div>

        <div className="mt-3 grid gap-3 stagger-children">
          {visibleTeamGroups.map((team) => (
            <section key={team.teamName} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{team.teamName}</p>
              <ul className="grid gap-1">
                <li className="rounded-md px-2 py-1 text-xs" style={{ backgroundColor: "var(--surface)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <QuickAddButton
                      afterpartyId={afterparty.id}
                      returnDate={date || afterparty.eventDate}
                      returnPath={returnPath}
                      name={team.angel}
                      accent
                    />
                    <div className="flex flex-wrap justify-end gap-1">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={currentAfterpartyNames.has(normalizeName(team.angel)) ? { backgroundColor: "var(--success-bg)", color: "var(--success)" } : { backgroundColor: "var(--surface-alt)", color: "var(--ink-muted)" }}>
                        {currentAfterpartyNames.has(normalizeName(team.angel)) ? "추가됨" : "미추가"}
                      </span>
                      {(assignmentByName.get(normalizeName(team.angel)) ?? []).map((entry) => (
                        <span
                          key={`${team.teamName}-${team.angel}-${entry.kind}-${entry.title}`}
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={
                            entry.kind === "afterparty"
                              ? { backgroundColor: "rgba(3, 105, 161, 0.12)", color: "#0369a1" }
                              : { backgroundColor: "var(--angel-bg)", color: "var(--angel)" }
                          }
                        >
                          {entry.kind === "study" ? `스터디 · ${entry.title}` : `뒷풀이 · ${entry.title}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>

                {team.members.map((member) => (
                  <li key={`${team.teamName}-${member}`} className="rounded-md px-2 py-1 text-xs" style={{ backgroundColor: "var(--surface)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <QuickAddButton
                        afterpartyId={afterparty.id}
                        returnDate={date || afterparty.eventDate}
                        returnPath={returnPath}
                        name={member}
                      />
                      <div className="flex flex-wrap justify-end gap-1">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={currentAfterpartyNames.has(normalizeName(member)) ? { backgroundColor: "var(--success-bg)", color: "var(--success)" } : { backgroundColor: "var(--surface-alt)", color: "var(--ink-muted)" }}>
                          {currentAfterpartyNames.has(normalizeName(member)) ? "추가됨" : "미추가"}
                        </span>
                        {(assignmentByName.get(normalizeName(member)) ?? []).map((entry) => (
                          <span
                            key={`${team.teamName}-${member}-${entry.kind}-${entry.title}`}
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={
                              entry.kind === "afterparty"
                                ? { backgroundColor: "rgba(3, 105, 161, 0.12)", color: "#0369a1" }
                                : { backgroundColor: "var(--angel-bg)", color: "var(--angel)" }
                            }
                          >
                            {entry.kind === "study" ? `스터디 · ${entry.title}` : `뒷풀이 · ${entry.title}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
