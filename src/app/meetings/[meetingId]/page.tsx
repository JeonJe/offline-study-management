import Link from "next/link";
import {
  bulkCreateRsvpsAction,
  deleteMeetingAction,
  deleteRsvpAction,
  updateMeetingAction,
} from "@/app/actions";
import { isAuthenticated } from "@/lib/auth";
import {
  listAfterpartiesByDate,
  listParticipantsForAfterparties,
} from "@/lib/afterparty-store";
import {
  getMeetingById,
  listMeetingsByDate,
  listRsvpsForMeetings,
  type ParticipantRole,
  type RsvpRecord,
} from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";
import { redirect } from "next/navigation";
import { EditManageModal } from "@/app/meetings/[meetingId]/edit-manage-modal";
import { DeleteConfirmButton } from "@/app/meetings/[meetingId]/delete-confirm-button";
import type { CSSProperties } from "react";
import { extractHttpUrl } from "@/lib/location-utils";
import {
  normalizeMemberName,
  toTeamLabel,
  withTeamLabel,
} from "@/lib/member-label-utils";
import {
  PARTICIPANT_ROLE_META,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";

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
  label,
  className,
  style,
}: {
  meetingId: string;
  returnPath: string;
  name: string;
  role: ParticipantRole;
  label?: string;
  className: string;
  style?: CSSProperties;
}) {
  const roleMeta = PARTICIPANT_ROLE_META[role];
  return (
    <form action={bulkCreateRsvpsAction} className="inline">
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="names" value={name} />
      <button type="submit" className={className} style={style}>
        {roleMeta.emoji ? `${roleMeta.emoji} ` : ""}{label ?? name}
      </button>
    </form>
  );
}

function normalizeName(value: string): string {
  return normalizeMemberName(value);
}

function teamOrderFromLabel(teamLabel: string): number {
  const matched = teamLabel.match(/(\d+)\s*팀/);
  if (!matched?.[1]) return Number.POSITIVE_INFINITY;
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function roleOrderIndex(role: ParticipantRole): number {
  const index = PARTICIPANT_ROLE_ORDER.indexOf(role);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function sortRsvpsForRole(
  rows: RsvpRecord[],
  role: ParticipantRole,
  teamLabelByName: Map<string, string>
): RsvpRecord[] {
  const sorted = [...rows];
  if (role === "student") {
    sorted.sort((a, b) => {
      const teamA = teamLabelByName.get(normalizeName(a.name)) ?? "";
      const teamB = teamLabelByName.get(normalizeName(b.name)) ?? "";
      const teamOrderA = teamOrderFromLabel(teamA);
      const teamOrderB = teamOrderFromLabel(teamB);

      if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB;
      if (teamA !== teamB) return teamA.localeCompare(teamB, "ko");

      return normalizeName(a.name).localeCompare(normalizeName(b.name), "ko");
    });
    return sorted;
  }

  sorted.sort((a, b) =>
    withTeamLabel(a.name, teamLabelByName).localeCompare(
      withTeamLabel(b.name, teamLabelByName),
      "ko"
    )
  );
  return sorted;
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
  displayName,
}: {
  row: RsvpRecord;
  meetingId: string;
  returnPath: string;
  displayName?: string;
}) {
  const roleMeta = PARTICIPANT_ROLE_META[row.role];
  const displayText = `${roleMeta.emoji ? `${roleMeta.emoji} ` : ""}${displayName ?? row.name}`;

  return (
    <li
      className="flex h-6 items-center rounded-full border px-2 leading-none"
      style={{
        borderColor: "var(--line)",
        backgroundColor: "var(--surface)",
        color: roleMeta.textColor,
      }}
    >
      <span className="block text-xs font-medium leading-none">{displayText}</span>

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

  const [meeting, memberPreset] = await Promise.all([
    getMeetingById(meetingId),
    loadMemberPreset(),
  ]);
  if (!meeting) {
    redirect(date ? `/?date=${date}` : "/");
  }

  const [sameDateMeetings, sameDateAfterparties] = await Promise.all([
    listMeetingsByDate(meeting.meetingDate),
    listAfterpartiesByDate(meeting.meetingDate),
  ]);

  const [rsvpsByMeeting, participantsByAfterparty] = await Promise.all([
    listRsvpsForMeetings(sameDateMeetings.map((item) => item.id), ""),
    listParticipantsForAfterparties(sameDateAfterparties.map((item) => item.id), ""),
  ]);

  const rsvps = rsvpsByMeeting[meetingId] ?? [];
  const teamLabelByName = new Map<string, string>();
  for (const group of memberPreset.teamGroups) {
    const teamLabel = toTeamLabel(group.teamName);
    if (!teamLabel) continue;

    for (const angel of group.angels) {
      const normalizedAngelName = normalizeName(angel);
      if (!teamLabelByName.has(normalizedAngelName)) {
        teamLabelByName.set(normalizedAngelName, teamLabel);
      }
    }

    for (const member of group.members) {
      const normalizedMemberName = normalizeName(member);
      if (!teamLabelByName.has(normalizedMemberName)) {
        teamLabelByName.set(normalizedMemberName, teamLabel);
      }
    }
  }
  const operationRoleOrder = PARTICIPANT_ROLE_ORDER.filter(
    (role): role is Exclude<ParticipantRole, "student"> => role !== "student"
  );
  const operationNamesByRole = new Map<Exclude<ParticipantRole, "student">, string[]>();
  for (const role of operationRoleOrder) {
    operationNamesByRole.set(role, []);
  }
  const roleByName = new Map<string, Exclude<ParticipantRole, "student">>();
  const seenOperationNames = new Set<string>();
  for (const role of operationRoleOrder) {
    const candidates =
      role === "angel"
        ? [...memberPreset.teamGroups.flatMap((group) => group.angels), ...memberPreset.fixedAngels]
        : memberPreset.specialRoles[role] ?? [];
    for (const rawName of candidates) {
      const name = rawName.trim();
      if (!name) continue;
      const normalized = normalizeName(name);
      if (!roleByName.has(normalized)) {
        roleByName.set(normalized, role);
      }
      if (seenOperationNames.has(normalized)) continue;
      seenOperationNames.add(normalized);
      const bucket = operationNamesByRole.get(role) ?? [];
      bucket.push(name);
      operationNamesByRole.set(role, bucket);
    }
  }

  const displayRsvps = rsvps.map((row) => {
    const resolvedRole = roleByName.get(normalizeName(row.name));
    if (row.role === "student" && resolvedRole) {
      return { ...row, role: resolvedRole };
    }
    return row;
  });
  const groupedByRole = new Map<ParticipantRole, RsvpRecord[]>();
  for (const role of PARTICIPANT_ROLE_ORDER) {
    groupedByRole.set(role, []);
  }
  for (const row of displayRsvps) {
    const existing = groupedByRole.get(row.role) ?? [];
    existing.push(row);
    groupedByRole.set(row.role, existing);
  }
  for (const role of PARTICIPANT_ROLE_ORDER) {
    groupedByRole.set(
      role,
      sortRsvpsForRole(groupedByRole.get(role) ?? [], role, teamLabelByName)
    );
  }
  const sortedParticipantRows = PARTICIPANT_ROLE_ORDER.flatMap(
    (role) => groupedByRole.get(role) ?? []
  );

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

  const operationEntries = operationRoleOrder.flatMap((role) =>
    (operationNamesByRole.get(role) ?? []).map((name) => ({ name, role }))
  ).sort((a, b) => {
    const roleDiff = roleOrderIndex(a.role) - roleOrderIndex(b.role);
    if (roleDiff !== 0) return roleDiff;

    const teamA = teamLabelByName.get(normalizeName(a.name)) ?? "";
    const teamB = teamLabelByName.get(normalizeName(b.name)) ?? "";
    const teamOrderA = teamOrderFromLabel(teamA);
    const teamOrderB = teamOrderFromLabel(teamB);
    if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB;
    if (teamA !== teamB) return teamA.localeCompare(teamB, "ko");
    return normalizeName(a.name).localeCompare(normalizeName(b.name), "ko");
  });
  const quickAddGroups = [
    ...memberPreset.teamGroups.map((team) => ({
      kind: "team" as const,
      teamName: team.teamName,
      entries: team.members
        .map((name) => ({
          name,
          role: roleByName.get(normalizeName(name)) ?? ("student" as const),
        }))
        .sort((a, b) => {
          const roleDiff = roleOrderIndex(a.role) - roleOrderIndex(b.role);
          if (roleDiff !== 0) return roleDiff;

          const teamA = teamLabelByName.get(normalizeName(a.name)) ?? "";
          const teamB = teamLabelByName.get(normalizeName(b.name)) ?? "";
          const teamOrderA = teamOrderFromLabel(teamA);
          const teamOrderB = teamOrderFromLabel(teamB);
          if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB;
          if (teamA !== teamB) return teamA.localeCompare(teamB, "ko");
          return normalizeName(a.name).localeCompare(normalizeName(b.name), "ko");
        }),
    })),
    ...(operationEntries.length > 0
      ? [{ kind: "operation" as const, teamName: "운영진", entries: operationEntries }]
      : []),
  ];
  const visibleQuickAddGroups = teamFilter
    ? quickAddGroups.filter((group) => group.teamName === teamFilter)
    : quickAddGroups;

  const totalMemberCount = visibleQuickAddGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0
  );
  const assignedCount = visibleQuickAddGroups.reduce(
    (sum, group) =>
      sum + group.entries.filter((entry) => assignmentByName.has(normalizeName(entry.name))).length,
    0
  );

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
                <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                  <span className="font-semibold">장소:</span> <LocationValue location={meeting.location} />
                </p>
                <section
                  className="mt-3 rounded-xl border p-3"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
                >
                  <p className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>메모</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                    {meeting.description || "등록된 메모가 없습니다."}
                  </p>
                </section>
                <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                  총 {meeting.totalCount}명 · 멤버 {meeting.studentCount}명 · 운영진 {meeting.operationCount}명
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
                      placeholder="장소명 + 링크 입력 시 메인 카드에서 장소 텍스트가 링크로 표시됩니다"
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
            {sortedParticipantRows.length > 0 ? (
              <div
                className="mt-3 rounded-xl border p-3"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
              >
                <ul className="flex flex-wrap gap-1">
                  {sortedParticipantRows.map((row) => (
                    <ParticipantChip
                      key={row.id}
                      row={row}
                      meetingId={meeting.id}
                      returnPath={returnPath}
                      displayName={withTeamLabel(row.name, teamLabelByName)}
                    />
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-xs" style={{ color: "var(--ink-muted)" }}>없음</p>
            )}
          </section>

        <section
          id="team-assignment"
          className="mt-4 card-static p-4 fade-in"
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>오프라인 스터디 참여자 관리</h2>
          <div
            className="mt-2 rounded-lg border border-dashed px-2.5 py-2 text-[11px] leading-relaxed"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
          >
            팀/운영진 필터를 선택한 뒤 이름을 클릭하면 현재 모임 참여자로 바로 추가됩니다. 오른쪽 배지는 해당 인원의 할당 상태입니다.
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
            {quickAddGroups.map((group) => (
              <Link
                key={`filter-${group.kind}-${group.teamName}`}
                href={teamFilterHref(group.teamName)}
                className="btn-press rounded-full border px-2 py-1 text-[11px] font-semibold transition"
                style={
                  teamFilter === group.teamName
                    ? { borderColor: "var(--accent)", backgroundColor: "rgba(194, 65, 12, 0.1)", color: "var(--accent)" }
                    : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }
                }
              >
                {group.teamName}
              </Link>
            ))}
          </div>

          <div className="mt-3 grid gap-3 stagger-children">
            {visibleQuickAddGroups.map((group) => (
              <section
                key={`${group.kind}-${group.teamName}`}
                className="rounded-xl border p-3"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
              >
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{group.teamName}</p>
                <ul className="grid gap-1">
                  {group.entries.map((entry) => {
                    const normalizedEntryName = normalizeName(entry.name);
                    const assignedTitles = assignmentByName.get(normalizedEntryName) ?? [];
                    const roleMeta = PARTICIPANT_ROLE_META[entry.role];
                    return (
                      <li
                        key={`${group.teamName}-${entry.role}-${entry.name}`}
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ backgroundColor: "var(--surface)" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <QuickAssignButton
                            meetingId={meeting.id}
                            returnPath={assignmentReturnPath}
                            name={entry.name}
                            role={entry.role}
                            label={withTeamLabel(entry.name, teamLabelByName)}
                            className="underline-offset-2 hover:underline"
                            style={{ color: roleMeta.textColor }}
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
                            {assignedTitles.map((assignedEntry) => (
                              <span
                                key={`${group.teamName}-${entry.role}-${entry.name}-${assignedEntry.kind}-${assignedEntry.title}`}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={
                                  assignedEntry.kind === "afterparty"
                                    ? { backgroundColor: "rgba(3, 105, 161, 0.12)", color: "#0369a1" }
                                    : { backgroundColor: roleMeta.backgroundColor, color: roleMeta.textColor }
                                }
                              >
                                {assignedEntry.kind === "study" ? `스터디 · ${assignedEntry.title}` : `뒷풀이 · ${assignedEntry.title}`}
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
