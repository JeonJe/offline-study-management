import Link from "next/link";
import {
  bulkCreateRsvpsAction,
  deleteMeetingAction,
  deleteRsvpAction,
  updateMeetingAction,
  updateRsvpAction,
} from "@/app/actions";
import { isAuthenticated } from "@/lib/auth";
import {
  listAfterparties,
  listParticipantsForAfterparties,
} from "@/lib/afterparty-store";
import {
  listMeetings,
  listRsvpsForMeetings,
  type RsvpRecord,
} from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";
import { redirect } from "next/navigation";
import { EditManageModal } from "@/app/meetings/[meetingId]/edit-manage-modal";
import { DeleteConfirmButton } from "@/app/meetings/[meetingId]/delete-confirm-button";
import type { CSSProperties } from "react";

type PageProps = {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function QuickAssignButton({
  meetingId,
  returnPath,
  name,
  role,
  className,
  style,
}: {
  meetingId: string;
  returnPath: string;
  name: string;
  role: "student" | "angel";
  className: string;
  style?: CSSProperties;
}) {
  return (
    <form action={bulkCreateRsvpsAction} className="inline">
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="names" value={name} />
      <button type="submit" className={className} style={style}>
        {name}
      </button>
    </form>
  );
}

function normalizeName(value: string): string {
  return value
    .replace(/\([^)]*\)/g, "")
    .replace(/^\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

function ParticipantChip({
  row,
  meetingId,
  returnPath,
}: {
  row: RsvpRecord;
  meetingId: string;
  returnPath: string;
}) {
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

      <form action={deleteRsvpAction}>
        <input type="hidden" name="meetingId" value={meetingId} />
        <input type="hidden" name="rsvpId" value={row.id} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <DeleteConfirmButton
          confirmMessage={`${row.name}을(를) 참여자 목록에서 제거합니다.`}
          className="rounded-full px-1 text-[11px] font-semibold transition hover:text-rose-600"
          style={{ color: "var(--ink-muted)" }}
          aria-label="참여자 제거"
          title="제거"
        >
          ×
        </DeleteConfirmButton>
      </form>
    </li>
  );
}

function ProgressBar({ assigned, total }: { assigned: number; total: number }) {
  const percent = total > 0 ? Math.round((assigned / total) * 100) : 0;
  return (
    <div className="mt-2 mb-3">
      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--ink-soft)" }}>
        <span>{percent}% 할당</span>
        <span>{assigned}/{total}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-alt)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: percent === 100 ? "var(--success)" : "var(--accent)" }}
        />
      </div>
    </div>
  );
}

export default async function MeetingDetailPage({ params, searchParams }: PageProps) {
  const { meetingId } = await params;
  const query = await searchParams;
  const date = singleParam(query.date);
  const teamFilter = singleParam(query.team);

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [meetings, memberPreset, allAfterparties] = await Promise.all([
    listMeetings(),
    loadMemberPreset(),
    listAfterparties(),
  ]);

  const meeting = meetings.find((item) => item.id === meetingId);
  if (!meeting) {
    redirect(date ? `/?date=${date}` : "/");
  }

  const sameDateMeetings = meetings.filter((item) => item.meetingDate === meeting.meetingDate);
  const sameDateAfterparties = allAfterparties.filter(
    (item) => item.eventDate === meeting.meetingDate
  );

  const [rsvpsByMeeting, participantsByAfterparty] = await Promise.all([
    listRsvpsForMeetings(sameDateMeetings.map((item) => item.id), ""),
    listParticipantsForAfterparties(sameDateAfterparties.map((item) => item.id), ""),
  ]);

  const rsvps = rsvpsByMeeting[meetingId] ?? [];
  const angels = rsvps.filter((row) => row.role === "angel");
  const members = rsvps.filter((row) => row.role === "student");

  const assignmentByName = new Map<string, { title: string; kind: "study" | "afterparty" }[]>();
  for (const meetingRow of sameDateMeetings) {
    const rows = rsvpsByMeeting[meetingRow.id] ?? [];
    for (const row of rows) {
      addAssignment(assignmentByName, normalizeName(row.name), meetingRow.title, "study");
    }
  }

  for (const afterparty of sameDateAfterparties) {
    const participants = participantsByAfterparty[afterparty.id] ?? [];
    for (const participant of participants) {
      addAssignment(assignmentByName, normalizeName(participant.name), afterparty.title, "afterparty");
    }
  }

  const visibleTeamGroups = teamFilter
    ? memberPreset.teamGroups.filter((team) => team.teamName === teamFilter)
    : memberPreset.teamGroups;

  const totalMemberCount = visibleTeamGroups.reduce(
    (sum, team) => sum + team.members.length + 1,
    0
  );
  const assignedCount = visibleTeamGroups.reduce((sum, team) => {
    const memberAssigned = team.members.filter((name) => assignmentByName.has(normalizeName(name))).length;
    const angelAssigned = assignmentByName.has(normalizeName(team.angel)) ? 1 : 0;
    return sum + memberAssigned + angelAssigned;
  }, 0);

  const returnParams = new URLSearchParams();
  if (date) returnParams.set("date", date);
  if (teamFilter) returnParams.set("team", teamFilter);
  const returnQuery = returnParams.toString();
  const returnPath = `/meetings/${meetingId}${returnQuery ? `?${returnQuery}` : ""}`;
  const assignmentReturnPath = `${returnPath}#team-assignment`;
  const backPath = date ? `/?date=${date}` : "/";

  function teamFilterHref(teamName?: string): string {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (teamName) params.set("team", teamName);
    const queryText = params.toString();
    return `/meetings/${meetingId}${queryText ? `?${queryText}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mb-4">
        <Link
          href={backPath}
          className="text-sm font-semibold hover:underline"
          style={{ color: "var(--accent)" }}
        >
          ← 보드로 돌아가기
        </Link>
      </div>

      <div className="stagger-children">
          <section className="card-static p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1
                  className="text-xl tracking-tight"
                  style={{ fontFamily: "var(--font-instrument-serif), serif", color: "var(--ink)" }}
                >
                  {meeting.title}
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>{meeting.location}</p>
                <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                  총 {meeting.totalCount}명 · 멤버 {meeting.studentCount}명 · 엔젤 {meeting.angelCount}명
                </p>
              </div>

              <EditManageModal>
                <section
                  className="rounded-xl border p-4"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
                >
                  <h3 className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>모임 정보 수정</h3>
                  <form action={updateMeetingAction} className="mt-3 grid gap-2 text-sm">
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <input
                      name="title" required defaultValue={meeting.title}
                      className="h-10 rounded-lg border bg-white px-3"
                      style={{ borderColor: "var(--line)" }}
                    />
                    <input
                      name="location" required defaultValue={meeting.location}
                      className="h-10 rounded-lg border bg-white px-3"
                      style={{ borderColor: "var(--line)" }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        name="meetingDate" type="date" required defaultValue={meeting.meetingDate}
                        className="h-10 rounded-lg border bg-white px-3"
                        style={{ borderColor: "var(--line)" }}
                      />
                      <input
                        name="startTime" type="time" required defaultValue={meeting.startTime}
                        className="h-10 rounded-lg border bg-white px-3"
                        style={{ borderColor: "var(--line)" }}
                      />
                    </div>
                    <input
                      name="description" defaultValue={meeting.description ?? ""}
                      className="h-10 rounded-lg border bg-white px-3"
                      style={{ borderColor: "var(--line)" }}
                      placeholder="설명"
                    />
                    <button
                      type="submit"
                      className="btn-press h-10 rounded-lg text-sm font-semibold text-white"
                      style={{ backgroundColor: "var(--ink)" }}
                    >
                      저장
                    </button>
                  </form>
                </section>

                <section
                  className="mt-4 rounded-xl border p-4"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
                >
                  <h3 className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>참여자 수정/삭제</h3>
                  <div className="mt-2 grid gap-2">
                    {rsvps.map((row) => (
                      <details
                        key={row.id}
                        className="rounded-lg border bg-white p-2"
                        style={{ borderColor: "var(--line)" }}
                      >
                        <summary className="cursor-pointer text-xs" style={{ color: "var(--ink-soft)" }}>
                          {row.role === "angel" ? "🪽 " : ""}
                          {row.name}
                          {row.note ? ` (${row.note})` : ""}
                        </summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                          <form action={updateRsvpAction} className="grid gap-2 text-xs sm:grid-cols-[1.1fr_120px_1fr_auto] sm:items-center">
                            <input type="hidden" name="meetingId" value={meeting.id} />
                            <input type="hidden" name="rsvpId" value={row.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <input name="name" required defaultValue={row.name} className="h-8 rounded-lg border bg-white px-2" style={{ borderColor: "var(--line)" }} />
                            <select name="role" defaultValue={row.role} className="h-8 rounded-lg border bg-white px-2" style={{ borderColor: "var(--line)" }}>
                              <option value="student">멤버</option>
                              <option value="angel">엔젤</option>
                            </select>
                            <input name="note" defaultValue={row.note ?? ""} className="h-8 rounded-lg border bg-white px-2" style={{ borderColor: "var(--line)" }} placeholder="팀명" />
                            <button type="submit" className="btn-press h-8 rounded-lg border px-2 font-medium" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>수정</button>
                          </form>
                          <form action={deleteRsvpAction}>
                            <input type="hidden" name="meetingId" value={meeting.id} />
                            <input type="hidden" name="rsvpId" value={row.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <button
                              type="submit"
                              className="btn-press h-8 rounded-lg border px-2 text-xs font-medium"
                              style={{ borderColor: "#fecaca", color: "var(--danger)" }}
                            >
                              삭제
                            </button>
                          </form>
                        </div>
                      </details>
                    ))}
                    {rsvps.length === 0 ? <p className="text-sm" style={{ color: "var(--ink-muted)" }}>등록된 참여자가 없습니다.</p> : null}
                  </div>
                </section>

                <section
                  className="mt-4 rounded-xl border p-4"
                  style={{ borderColor: "#fecaca", backgroundColor: "var(--danger-bg)" }}
                >
                  <h3 className="text-xs font-semibold" style={{ color: "var(--danger)" }}>모임 삭제</h3>
                  <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                    이 모임과 참여자 데이터가 함께 삭제됩니다.
                  </p>
                  <form action={deleteMeetingAction} className="mt-3">
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <input type="hidden" name="returnDate" value={meeting.meetingDate} />
                    <DeleteConfirmButton
                      confirmMessage={`"${meeting.title}" 모임과 모든 참여자 데이터가 삭제됩니다. 계속하시겠습니까?`}
                      className="btn-press h-9 rounded-lg px-3 text-xs font-semibold text-white"
                      style={{ backgroundColor: "var(--danger)" }}
                    >
                      이 모임 삭제
                    </DeleteConfirmButton>
                  </form>
                </section>
              </EditManageModal>
            </div>
          </section>

          <section className="mt-4 card-static p-5">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>참여자</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div
                className="rounded-xl border p-3"
                style={{ borderColor: "#fbbf24", backgroundColor: "rgba(254, 243, 199, 0.3)" }}
              >
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--angel)" }}>엔젤</p>
                <ul className="flex flex-wrap gap-1">
                  {angels.map((row) => (
                    <ParticipantChip
                      key={row.id}
                      row={row}
                      meetingId={meeting.id}
                      returnPath={returnPath}
                    />
                  ))}
                  {angels.length === 0 ? <li className="text-xs" style={{ color: "var(--ink-muted)" }}>없음</li> : null}
                </ul>
              </div>
              <div
                className="rounded-xl border p-3"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
              >
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>멤버</p>
                <ul className="flex flex-wrap gap-1">
                  {members.map((row) => (
                    <ParticipantChip
                      key={row.id}
                      row={row}
                      meetingId={meeting.id}
                      returnPath={returnPath}
                    />
                  ))}
                  {members.length === 0 ? <li className="text-xs" style={{ color: "var(--ink-muted)" }}>없음</li> : null}
                </ul>
              </div>
            </div>
          </section>

        <section
          id="team-assignment"
          className="mt-4 card-static p-4 fade-in"
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>팀 할당 현황</h2>
          <div
            className="mt-2 rounded-lg border border-dashed px-2.5 py-2 text-[11px] leading-relaxed"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
          >
            이름을 클릭하면 현재 모임 참여자로 바로 추가됩니다. 오른쪽 배지는 해당 인원의 할당 상태입니다.
          </div>
          <ProgressBar assigned={assignedCount} total={totalMemberCount} />

          <div className="flex flex-wrap gap-1">
            <Link
              href={teamFilterHref()}
              className="btn-press rounded-full border px-2 py-1 text-[11px] font-semibold transition"
              style={
                !teamFilter
                  ? { borderColor: "var(--accent)", backgroundColor: "rgba(194, 65, 12, 0.1)", color: "var(--accent)" }
                  : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }
              }
            >
              전체
            </Link>
            {memberPreset.teamGroups.map((team) => (
              <Link
                key={`filter-${team.teamName}`}
                href={teamFilterHref(team.teamName)}
                className="btn-press rounded-full border px-2 py-1 text-[11px] font-semibold transition"
                style={
                  teamFilter === team.teamName
                    ? { borderColor: "var(--accent)", backgroundColor: "rgba(194, 65, 12, 0.1)", color: "var(--accent)" }
                    : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }
                }
              >
                {team.teamName}
              </Link>
            ))}
          </div>

          <div className="mt-3 grid gap-3 stagger-children">
            {visibleTeamGroups.map((team) => (
              <section
                key={team.teamName}
                className="rounded-xl border p-3"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
              >
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{team.teamName}</p>
                <ul className="grid gap-1">
                  {(() => {
                    const angelAssignments = assignmentByName.get(normalizeName(team.angel)) ?? [];
                    return (
                      <li
                        className="rounded-md bg-white px-2 py-1 text-xs"
                        style={{ backgroundColor: "var(--surface)" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <QuickAssignButton
                            meetingId={meeting.id}
                            returnPath={assignmentReturnPath}
                            name={team.angel}
                            role="angel"
                            className="font-medium underline-offset-2 hover:underline"
                            style={{ color: "var(--angel)" }}
                          />
                          <div className="flex flex-wrap justify-end gap-1">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={
                                angelAssignments.length > 0
                                  ? { backgroundColor: "var(--success-bg)", color: "var(--success)" }
                                  : { backgroundColor: "var(--surface-alt)", color: "var(--ink-muted)" }
                              }
                            >
                              {angelAssignments.length > 0 ? "할당됨" : "미할당"}
                            </span>
                            {angelAssignments.map((entry) => (
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
                    );
                  })()}

                  {team.members.map((member) => {
                    const assignedTitles = assignmentByName.get(normalizeName(member)) ?? [];

                    return (
                      <li
                        key={`${team.teamName}-${member}`}
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ backgroundColor: "var(--surface)" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <QuickAssignButton
                            meetingId={meeting.id}
                            returnPath={assignmentReturnPath}
                            name={member}
                            role="student"
                            className="underline-offset-2 hover:underline"
                            style={{ color: "var(--ink-soft)" }}
                          />
                          <div className="flex flex-wrap justify-end gap-1">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={
                                assignedTitles.length > 0
                                  ? { backgroundColor: "var(--success-bg)", color: "var(--success)" }
                                  : { backgroundColor: "var(--surface-alt)", color: "var(--ink-muted)" }
                              }
                            >
                              {assignedTitles.length > 0 ? "할당됨" : "미할당"}
                            </span>
                            {assignedTitles.map((entry) => (
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
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
