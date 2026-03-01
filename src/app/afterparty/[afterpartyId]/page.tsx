import Link from "next/link";
import { redirect } from "next/navigation";
import {
  bulkCreateAfterpartyParticipantsAction,
  createAfterpartySettlementAction,
  deleteAfterpartyAction,
  deleteAfterpartyParticipantAction,
  deleteAfterpartySettlementAction,
  updateAfterpartyAction,
  updateAfterpartySettlementAction,
} from "@/app/actions";
import { isAuthenticated } from "@/lib/auth";
import {
  normalizeMemberName,
  toTeamLabel,
  withTeamLabel,
} from "@/lib/member-label-utils";
import {
  type AfterpartyParticipant,
  type AfterpartySettlement,
} from "@/lib/afterparty-store";
import { EditManageModal } from "@/app/meetings/[meetingId]/edit-manage-modal";
import type { ParticipantRole } from "@/lib/meetup-store";
import {
  cachedGetAfterpartyById,
  cachedListParticipantsForSettlement,
  cachedListSettlementsForAfterparty,
  cachedLoadMemberPreset,
} from "@/lib/cached-queries";
import { SettlementToggle } from "@/app/afterparty/[afterpartyId]/settlement-toggle";
import {
  normalizeParticipantName,
  PARTICIPANT_ROLE_META,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";
import { PendingSubmitButton } from "@/app/pending-submit-button";

type PageProps = {
  params: Promise<{ afterpartyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeName(value: string): string {
  return normalizeParticipantName(value);
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

function QuickAddButton({
  afterpartyId,
  settlementId,
  returnDate,
  returnPath,
  name,
  role,
  label,
}: {
  afterpartyId: string;
  settlementId: string;
  returnDate: string;
  returnPath: string;
  name: string;
  role: ParticipantRole;
  label?: string;
}) {
  const roleMeta = PARTICIPANT_ROLE_META[role];
  return (
    <form action={bulkCreateAfterpartyParticipantsAction} className="inline">
      <input type="hidden" name="afterpartyId" value={afterpartyId} />
      <input type="hidden" name="settlementId" value={settlementId} />
      <input type="hidden" name="returnDate" value={returnDate} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <input type="hidden" name="names" value={name} />
      <input type="hidden" name="role" value={role} />
      <PendingSubmitButton
        idleLabel={`${roleMeta.emoji ? `${roleMeta.emoji} ` : ""}${label ?? name}`}
        pendingLabel="추가중..."
        className="underline-offset-2 hover:underline"
        style={{ color: roleMeta.textColor }}
      />
    </form>
  );
}

function ParticipantRow({
  row,
  afterpartyId,
  settlementId,
  returnDate,
  returnPath,
  displayName,
}: {
  row: AfterpartyParticipant;
  afterpartyId: string;
  settlementId: string;
  returnDate: string;
  returnPath: string;
  displayName?: string;
}) {
  const roleMeta = PARTICIPANT_ROLE_META[row.role];
  return (
    <li
      className="rounded-lg border px-2 py-2"
      style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: roleMeta.textColor }}>
          {roleMeta.emoji ? `${roleMeta.emoji} ` : ""}{displayName ?? row.name}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <SettlementToggle
            afterpartyId={afterpartyId}
            settlementId={settlementId}
            participantId={row.id}
            isSettled={row.isSettled}
          />

          <form action={deleteAfterpartyParticipantAction}>
            <input type="hidden" name="afterpartyId" value={afterpartyId} />
            <input type="hidden" name="settlementId" value={settlementId} />
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

function settlementProgressText(settlement: AfterpartySettlement): string {
  return `${settlement.settledCount}/${settlement.participantCount}`;
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

function sortParticipantsForRole(
  rows: AfterpartyParticipant[],
  role: ParticipantRole,
  teamLabelByMemberName: Map<string, string>
): AfterpartyParticipant[] {
  const sorted = [...rows];
  if (role === "student") {
    sorted.sort((a, b) => {
      const teamA = teamLabelByMemberName.get(normalizeMemberName(a.name)) ?? "";
      const teamB = teamLabelByMemberName.get(normalizeMemberName(b.name)) ?? "";
      const teamOrderA = teamOrderFromLabel(teamA);
      const teamOrderB = teamOrderFromLabel(teamB);

      if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB;
      if (teamA !== teamB) return teamA.localeCompare(teamB, "ko");

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

export default async function AfterpartyDetailPage({ params, searchParams }: PageProps) {
  const { afterpartyId } = await params;
  const query = await searchParams;
  const date = singleParam(query.date);
  const teamFilter = singleParam(query.team);
  const requestedSettlementId = singleParam(query.settlement);

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [afterparty, settlements, memberPreset] = await Promise.all([
    cachedGetAfterpartyById(afterpartyId),
    cachedListSettlementsForAfterparty(afterpartyId),
    cachedLoadMemberPreset(),
  ]);

  if (!afterparty) {
    redirect(date ? `/afterparty?date=${date}` : "/afterparty");
  }

  const selectedSettlement =
    settlements.find((item) => item.id === requestedSettlementId) ?? settlements[0] ?? null;

  if (!selectedSettlement) {
    redirect(date ? `/afterparty?date=${date}` : "/afterparty");
  }

  const participants = await cachedListParticipantsForSettlement(selectedSettlement.id, "");
  const settledCount = participants.filter((row) => row.isSettled).length;
  const unsettledCount = Math.max(participants.length - settledCount, 0);
  const teamLabelByMemberName = new Map<string, string>();
  for (const group of memberPreset.teamGroups) {
    const teamLabel = toTeamLabel(group.teamName);
    if (!teamLabel) continue;

    for (const angel of group.angels) {
      const normalizedAngelName = normalizeMemberName(angel);
      if (!teamLabelByMemberName.has(normalizedAngelName)) {
        teamLabelByMemberName.set(normalizedAngelName, teamLabel);
      }
    }

    for (const member of group.members) {
      const normalizedMemberName = normalizeMemberName(member);
      if (!teamLabelByMemberName.has(normalizedMemberName)) {
        teamLabelByMemberName.set(normalizedMemberName, teamLabel);
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

  const operationEntries = operationRoleOrder.flatMap((role) =>
    (operationNamesByRole.get(role) ?? []).map((name) => ({ name, role }))
  ).sort((a, b) => {
    const roleDiff = roleOrderIndex(a.role) - roleOrderIndex(b.role);
    if (roleDiff !== 0) return roleDiff;

    const teamA = teamLabelByMemberName.get(normalizeMemberName(a.name)) ?? "";
    const teamB = teamLabelByMemberName.get(normalizeMemberName(b.name)) ?? "";
    const teamOrderA = teamOrderFromLabel(teamA);
    const teamOrderB = teamOrderFromLabel(teamB);

    if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB;
    if (teamA !== teamB) return teamA.localeCompare(teamB, "ko");

    return normalizeMemberName(a.name).localeCompare(normalizeMemberName(b.name), "ko");
  });
  const currentSettlementNames = new Set(participants.map((row) => normalizeName(row.name)));
  const displayParticipants = participants.map((participant) => {
    const resolvedRole = roleByName.get(normalizeName(participant.name));
    if (participant.role === "student" && resolvedRole) {
      return {
        ...participant,
        role: resolvedRole,
      };
    }
    return participant;
  });
  const participantsByRole = new Map<ParticipantRole, AfterpartyParticipant[]>();
  for (const role of PARTICIPANT_ROLE_ORDER) {
    participantsByRole.set(role, []);
  }
  for (const participant of displayParticipants) {
    const existing = participantsByRole.get(participant.role) ?? [];
    existing.push(participant);
    participantsByRole.set(participant.role, existing);
  }
  for (const role of PARTICIPANT_ROLE_ORDER) {
    participantsByRole.set(
      role,
      sortParticipantsForRole(participantsByRole.get(role) ?? [], role, teamLabelByMemberName)
    );
  }
  const sortedParticipantRows = PARTICIPANT_ROLE_ORDER.flatMap(
    (role) => participantsByRole.get(role) ?? []
  );

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

          const teamA = teamLabelByMemberName.get(normalizeMemberName(a.name)) ?? "";
          const teamB = teamLabelByMemberName.get(normalizeMemberName(b.name)) ?? "";
          const teamOrderA = teamOrderFromLabel(teamA);
          const teamOrderB = teamOrderFromLabel(teamB);

          if (teamOrderA !== teamOrderB) return teamOrderA - teamOrderB;
          if (teamA !== teamB) return teamA.localeCompare(teamB, "ko");

          return normalizeMemberName(a.name).localeCompare(normalizeMemberName(b.name), "ko");
        }),
    })),
    ...(operationEntries.length > 0
      ? [
          {
            kind: "operation" as const,
            teamName: "운영진",
            entries: operationEntries,
          },
        ]
      : []),
  ];
  const visibleQuickAddGroups = teamFilter
    ? quickAddGroups.filter((group) => group.teamName === teamFilter)
    : quickAddGroups;

  const totalAssignableCount = visibleQuickAddGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0
  );
  const assignedCount = visibleQuickAddGroups.reduce(
    (sum, group) =>
      sum + group.entries.filter((entry) => currentSettlementNames.has(normalizeName(entry.name))).length,
    0
  );
  const assignRate = totalAssignableCount > 0 ? Math.round((assignedCount / totalAssignableCount) * 100) : 0;

  const returnParams = new URLSearchParams();
  if (date) returnParams.set("date", date);
  if (teamFilter) returnParams.set("team", teamFilter);
  returnParams.set("settlement", selectedSettlement.id);
  const returnQuery = returnParams.toString();
  const returnPath = `/afterparty/${afterpartyId}${returnQuery ? `?${returnQuery}` : ""}`;
  const backPath = date ? `/afterparty?date=${date}` : "/afterparty";

  function teamFilterHref(teamName?: string): string {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (teamName) params.set("team", teamName);
    params.set("settlement", selectedSettlement.id);
    const queryText = params.toString();
    return `/afterparty/${afterpartyId}${queryText ? `?${queryText}` : ""}`;
  }

  function settlementHref(settlementId: string): string {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (teamFilter) params.set("team", teamFilter);
    params.set("settlement", settlementId);
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

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="grid gap-3 lg:h-[calc(100vh-3rem)] lg:grid-rows-[auto_auto_minmax(0,1fr)]">
          <section className="card-static w-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl tracking-tight" style={{ fontFamily: "var(--font-heading), sans-serif", color: "var(--ink)" }}>
              {afterparty.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
              {afterparty.location} · {formatStartTime(afterparty.startTime)}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
              현재 정산 참여자 {participants.length}명 · 현재 정산 미정산 {unsettledCount}명
            </p>

            <section
              className="mt-3 rounded-xl border p-3"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>메모</p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                {afterparty.description || "등록된 메모가 없습니다."}
              </p>
            </section>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {settlements.map((settlement, index) => (
                <span
                  key={`header-settlement-count-${settlement.id}`}
                  className="rounded-full border px-2 py-1"
                  style={{ borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" }}
                >
                  {`정산${index + 1} 참여 ${settlement.participantCount}명`}
                </span>
              ))}
              <span
                className="rounded-full border px-2 py-1"
                style={{ borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" }}
              >
                선택 정산: {selectedSettlement.title}
              </span>
              <span
                className="rounded-full border px-2 py-1"
                style={{ borderColor: "#86efac", backgroundColor: "#ecfdf3", color: "#166534" }}
              >
                정산자: {selectedSettlement.settlementManager || "미등록"}
              </span>
              <span
                className="rounded-full border px-2 py-1"
                style={{ borderColor: "#7dd3fc", backgroundColor: "#f0f9ff", color: "#0c4a6e" }}
              >
                계좌: {selectedSettlement.settlementAccount || "미등록"}
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
                <input name="description" defaultValue={afterparty.description ?? ""} className="h-10 rounded-lg border bg-white px-3 md:col-span-2" style={{ borderColor: "var(--line)" }} placeholder="메모" />
                <button type="submit" className="btn-press h-10 rounded-lg text-sm font-semibold text-white md:w-28" style={{ backgroundColor: "var(--ink)" }}>
                  정보 저장
                </button>
              </form>
            </section>

            <section
              className="mt-4 rounded-xl border p-4"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
            >
              <h3 className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>정산 관리</h3>

              <form action={createAfterpartySettlementAction} className="mt-3 grid gap-2 text-sm md:grid-cols-12">
                <input type="hidden" name="afterpartyId" value={afterparty.id} />
                <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <input
                  name="title"
                  required
                  className="h-9 rounded-lg border bg-white px-3 md:col-span-3"
                  style={{ borderColor: "var(--line)" }}
                  placeholder="새 정산 이름 (예: 2차 카페)"
                />
                <input
                  name="settlementManager"
                  className="h-9 rounded-lg border bg-white px-3 md:col-span-2"
                  style={{ borderColor: "var(--line)" }}
                  placeholder="정산자"
                />
                <input
                  name="settlementAccount"
                  className="h-9 rounded-lg border bg-white px-3 md:col-span-5"
                  style={{ borderColor: "var(--line)" }}
                  placeholder="계좌번호 (은행명 + 번호)"
                />
                <button
                  type="submit"
                  className="btn-press h-9 rounded-lg border px-3 text-xs font-semibold md:col-span-2 md:w-full"
                  style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
                >
                  정산 추가
                </button>
              </form>

              <div className="mt-3 grid gap-3">
                {settlements.map((settlement) => (
                  <section
                    key={settlement.id}
                    className="rounded-lg border bg-white p-3"
                    style={{ borderColor: settlement.id === selectedSettlement.id ? "var(--accent)" : "var(--line)" }}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                        {settlement.title} · {settlementProgressText(settlement)}
                      </p>
                      <form action={`/afterparty/${afterpartyId}`} method="get">
                        {date ? <input type="hidden" name="date" value={date} /> : null}
                        {teamFilter ? <input type="hidden" name="team" value={teamFilter} /> : null}
                        <input type="hidden" name="settlement" value={settlement.id} />
                        <button
                          type="submit"
                          className="text-[11px] font-semibold hover:underline disabled:no-underline"
                          style={
                            settlement.id === selectedSettlement.id
                              ? { color: "var(--ink-muted)" }
                              : { color: "var(--accent)" }
                          }
                          disabled={settlement.id === selectedSettlement.id}
                        >
                          {settlement.id === selectedSettlement.id ? "선택됨" : "이 정산으로 전환"}
                        </button>
                      </form>
                    </div>

                    <div className="grid gap-2 text-xs">
                      <form
                        id={`settlement-update-${settlement.id}`}
                        action={updateAfterpartySettlementAction}
                        className="grid gap-2 md:grid-cols-3"
                      >
                        <input type="hidden" name="afterpartyId" value={afterparty.id} />
                        <input type="hidden" name="settlementId" value={settlement.id} />
                        <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <input
                          name="title"
                          required
                          defaultValue={settlement.title}
                          className="h-8 rounded-lg border bg-white px-2"
                          style={{ borderColor: "var(--line)" }}
                        />
                        <input
                          name="settlementManager"
                          defaultValue={settlement.settlementManager ?? ""}
                          className="h-8 rounded-lg border bg-white px-2"
                          style={{ borderColor: "var(--line)" }}
                          placeholder="정산자"
                        />
                        <input
                          name="settlementAccount"
                          defaultValue={settlement.settlementAccount ?? ""}
                          className="h-8 rounded-lg border bg-white px-2"
                          style={{ borderColor: "var(--line)" }}
                          placeholder="계좌"
                        />
                      </form>

                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="submit"
                          form={`settlement-update-${settlement.id}`}
                          className="btn-press h-8 rounded-lg border px-2 text-[11px] font-semibold"
                          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                        >
                          저장
                        </button>

                        {settlements.length > 1 ? (
                          <form action={deleteAfterpartySettlementAction}>
                            <input type="hidden" name="afterpartyId" value={afterparty.id} />
                            <input type="hidden" name="settlementId" value={settlement.id} />
                            <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <button
                              type="submit"
                              className="btn-press h-8 rounded-lg border px-2 text-[11px] font-semibold"
                              style={{ borderColor: "#fecaca", color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
                            >
                              삭제
                            </button>
                          </form>
                        ) : (
                          <span className="text-[10px]" style={{ color: "var(--ink-muted)" }}>
                            최소 1개 유지
                          </span>
                        )}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
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

          <section className="card-static p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>정산 선택</h2>
          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
            총 {settlements.length}개 정산
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {settlements.map((settlement) => (
            <Link
              key={settlement.id}
              href={settlementHref(settlement.id)}
              className="btn-press rounded-full border px-2 py-1 text-[11px] font-semibold"
                style={
                  settlement.id === selectedSettlement.id
                    ? { borderColor: "var(--accent)", backgroundColor: "var(--accent-weak)", color: "var(--accent)" }
                    : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }
                }
            >
              {settlement.title} · {settlementProgressText(settlement)}
            </Link>
          ))}
        </div>
          </section>

          <section className="card-static w-full p-5 lg:min-h-0 lg:flex lg:flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            참여자 관리 · {selectedSettlement.title}
          </h2>
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
          <input type="hidden" name="settlementId" value={selectedSettlement.id} />
          <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input
            name="names"
            className="h-9 w-full rounded-lg border bg-white px-2 text-xs sm:w-80"
            style={{ borderColor: "var(--line)" }}
            placeholder="이름 또는 이름,이름"
          />
          <select
            name="role"
            defaultValue=""
            className="h-9 rounded-lg border bg-white px-2 text-xs"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
          >
            <option value="">역할 자동 분류</option>
            {PARTICIPANT_ROLE_ORDER.map((role) => (
              <option key={`afterparty-role-option-${role}`} value={role}>
                {PARTICIPANT_ROLE_META[role].label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-press h-9 rounded-lg border px-2 text-xs font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            참여자 추가
          </button>
        </form>

        {sortedParticipantRows.length > 0 ? (
          <section
            className="mt-3 rounded-xl border p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
          >
            <ul className="grid gap-1.5">
              {sortedParticipantRows.map((row) => (
                <ParticipantRow
                  key={row.id}
                  row={row}
                  afterpartyId={afterparty.id}
                  settlementId={selectedSettlement.id}
                  returnDate={date || afterparty.eventDate}
                  returnPath={returnPath}
                  displayName={withTeamLabel(row.name, teamLabelByMemberName)}
                />
              ))}
            </ul>
          </section>
        ) : (
          <p className="mt-3 text-xs" style={{ color: "var(--ink-muted)" }}>등록된 참여자 없음</p>
        )}
          </section>
        </div>

        <aside className="card-static p-4 fade-in lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-hidden lg:flex lg:flex-col">
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>참여자</h2>
        <p className="mt-2 rounded-lg border border-dashed px-2.5 py-2 text-[11px]" style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}>
          팀/운영진 필터를 고른 뒤 이름을 클릭하면 선택된 정산에 바로 추가됩니다.
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
            style={!teamFilter ? { borderColor: "var(--accent)", backgroundColor: "var(--accent-weak)", color: "var(--accent)" } : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
          >
            전체
          </Link>
          {quickAddGroups.map((group) => (
            <Link
              key={`filter-${group.kind}-${group.teamName}`}
              href={teamFilterHref(group.teamName)}
              className="btn-press rounded-full border px-2 py-1 text-[11px] font-semibold transition"
              style={teamFilter === group.teamName ? { borderColor: "var(--accent)", backgroundColor: "var(--accent-weak)", color: "var(--accent)" } : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
            >
              {group.teamName}
            </Link>
          ))}
        </div>

        <div className="mt-3 grid gap-3 pr-1 stagger-children lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {visibleQuickAddGroups.map((group) => (
            <section key={`${group.kind}-${group.teamName}`} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{group.teamName}</p>
              <ul className="grid gap-1">
                {group.entries.map((entry) => {
                  const normalizedEntryName = normalizeName(entry.name);
                  return (
                    <li key={`${group.teamName}-${entry.role}-${entry.name}`} className="rounded-md px-2 py-1 text-xs" style={{ backgroundColor: "var(--surface)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <QuickAddButton
                          afterpartyId={afterparty.id}
                          settlementId={selectedSettlement.id}
                          returnDate={date || afterparty.eventDate}
                          returnPath={returnPath}
                          name={entry.name}
                          role={entry.role}
                          label={withTeamLabel(entry.name, teamLabelByMemberName)}
                        />
                        <div className="flex flex-wrap justify-end gap-1">
                          {currentSettlementNames.has(normalizedEntryName) ? (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}
                            >
                              추가됨
                            </span>
                          ) : (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink-muted)" }}
                            >
                              미할당
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        </aside>
      </div>
    </main>
  );
}
