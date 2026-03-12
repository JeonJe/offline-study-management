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
import { DeleteConfirmButton } from "@/app/meetings/[meetingId]/delete-confirm-button";
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
import { QuerySelectFilter } from "@/app/query-select-filter";
import { SharedFormPasswordField } from "@/app/shared-form-password-field";

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
  isAssigned,
}: {
  afterpartyId: string;
  settlementId: string;
  returnDate: string;
  returnPath: string;
  name: string;
  role: ParticipantRole;
  label?: string;
  isAssigned: boolean;
}) {
  const roleMeta = PARTICIPANT_ROLE_META[role];
  return (
    <form action={bulkCreateAfterpartyParticipantsAction} className="w-full">
      <input type="hidden" name="afterpartyId" value={afterpartyId} />
      <input type="hidden" name="settlementId" value={settlementId} />
      <input type="hidden" name="returnDate" value={returnDate} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <input type="hidden" name="names" value={name} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="mutationSource" value="quick-add" />
      <PendingSubmitButton
        pendingChildren={
          <div className="flex h-8 items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold" style={{ color: "var(--ink)" }}>
              {roleMeta.emoji ? `${roleMeta.emoji} ` : ""}{label ?? name}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: "var(--ink-soft)" }}>
              추가중...
            </span>
          </div>
        }
        disabled={isAssigned}
        className="btn-press flex h-8 w-full items-center justify-between gap-2 rounded-md border px-2.5 text-left text-xs transition active:scale-[0.99] disabled:cursor-default disabled:opacity-100"
        style={{
          borderColor: "var(--line)",
          backgroundColor: isAssigned ? "var(--surface-alt)" : "#ffffff",
        }}
      >
        <span
          className="min-w-0 truncate text-xs font-semibold"
          style={{ color: isAssigned ? "var(--ink-muted)" : "var(--ink)" }}
        >
          {roleMeta.emoji ? `${roleMeta.emoji} ` : ""}{label ?? name}
        </span>
        <span
          className="shrink-0 text-[10px] font-semibold"
          style={isAssigned ? { color: "var(--ink-muted)" } : { color: roleMeta.textColor }}
        >
          {isAssigned ? "추가됨" : "추가"}
        </span>
      </PendingSubmitButton>
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

type ParticipantFeedbackTone = "error" | "notice";

type ParticipantFeedback = {
  title: string;
  description: string;
  tone: ParticipantFeedbackTone;
};

function resolveParticipantFeedback(status: string, source: string): ParticipantFeedback | null {
  if (status === "invalid-input") {
    return {
      title: "이름 추가 실패",
      description: "이름을 읽지 못했습니다. 한 명은 그대로 입력하고, 여러 명은 쉼표로 구분해 주세요.",
      tone: "error",
    };
  }

  if (status === "already-added") {
    return {
      title: "변경된 참여자가 없습니다",
      description:
        source === "quick"
          ? "이미 추가된 이름이라 빠른추가에서 변경된 항목이 없습니다."
          : "이미 추가된 이름만 입력되어 새로 반영된 참여자가 없습니다.",
      tone: "notice",
    };
  }

  return null;
}

function ParticipantFeedbackBanner({ feedback }: { feedback: ParticipantFeedback }) {
  const palette =
    feedback.tone === "error"
      ? {
          borderColor: "#fecaca",
          backgroundColor: "#fff1f2",
          titleColor: "var(--danger)",
        }
      : {
          borderColor: "#fde68a",
          backgroundColor: "#fffbeb",
          titleColor: "#b45309",
        };

  return (
    <section
      className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }}
    >
      <p className="text-sm font-semibold" style={{ color: palette.titleColor }}>
        {feedback.title}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
        {feedback.description}
      </p>
    </section>
  );
}

export default async function AfterpartyDetailPage({ params, searchParams }: PageProps) {
  const { afterpartyId } = await params;
  const query = await searchParams;
  const date = singleParam(query.date);
  const teamFilter = singleParam(query.team);
  const participantSearch = singleParam(query.participantSearch).trim();
  const requestedSettlementId = singleParam(query.settlement);
  const manageStatus = singleParam(query.manage);
  const participantStatus = singleParam(query.participantStatus);
  const participantSource = singleParam(query.participantSource);
  const participantDraft = singleParam(query.participantDraft);

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

  const manageErrorMessage =
    manageStatus === "password-required"
      ? "이 뒷풀이는 비밀번호가 설정되어 있어 저장 또는 삭제 전에 비밀번호를 입력해야 합니다."
      : manageStatus === "password-invalid"
        ? "뒷풀이 비밀번호가 일치하지 않습니다."
        : "";
  const managePasswordFieldMessage =
    manageStatus === "password-required"
      ? "현재 뒷풀이 비밀번호를 입력해 주세요."
      : manageStatus === "password-invalid"
        ? "현재 뒷풀이 비밀번호가 일치하지 않습니다."
        : "";

  const selectedSettlement =
    settlements.find((item) => item.id === requestedSettlementId) ?? settlements[0] ?? null;

  if (!selectedSettlement) {
    redirect(date ? `/afterparty?date=${date}` : "/afterparty");
  }

  const participantFeedback = resolveParticipantFeedback(participantStatus, participantSource);
  const manualParticipantFeedback =
    participantFeedback && participantSource === "manual" ? participantFeedback : null;
  const quickParticipantFeedback =
    participantFeedback && participantSource === "quick" ? participantFeedback : null;
  const manualParticipantDraft = participantSource === "manual" ? participantDraft : "";

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
  const normalizedParticipantSearch = normalizeName(participantSearch);
  const quickAddGroupsByFilter = teamFilter
    ? quickAddGroups.filter((group) => group.teamName === teamFilter)
    : quickAddGroups;
  const visibleQuickAddGroups = quickAddGroupsByFilter
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => {
        if (!normalizedParticipantSearch) return true;
        const displayName = withTeamLabel(entry.name, teamLabelByMemberName);
        return (
          normalizeName(entry.name).includes(normalizedParticipantSearch) ||
          normalizeName(displayName).includes(normalizedParticipantSearch)
        );
      }),
    }))
    .filter((group) => group.entries.length > 0);

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
  if (participantSearch) returnParams.set("participantSearch", participantSearch);
  returnParams.set("settlement", selectedSettlement.id);
  const returnQuery = returnParams.toString();
  const returnPath = `/afterparty/${afterpartyId}${returnQuery ? `?${returnQuery}` : ""}`;
  const manualReturnPath = `${returnPath}#participant-manual-add`;
  const quickAddReturnPath = `${returnPath}#participant-quick-add`;
  const backPath = date ? `/afterparty?date=${date}` : "/afterparty";
  const managePasswordTargets = afterparty.hasPassword
    ? [
        { formId: "afterparty-update-form", name: "afterpartyPassword" },
        { formId: "afterparty-create-settlement-form", name: "afterpartyPassword" },
        { formId: "afterparty-delete-form", name: "afterpartyPassword" },
        ...settlements.flatMap((settlement) => [
          {
            formId: `afterparty-settlement-update-${settlement.id}`,
            name: "afterpartyPassword",
          },
          {
            formId: `afterparty-settlement-delete-${settlement.id}`,
            name: "afterpartyPassword",
          },
        ]),
      ]
    : [];

  function settlementHref(settlementId: string): string {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (teamFilter) params.set("team", teamFilter);
    if (participantSearch) params.set("participantSearch", participantSearch);
    params.set("settlement", settlementId);
    const queryText = params.toString();
    return `/afterparty/${afterpartyId}${queryText ? `?${queryText}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-4">
        <Link href={backPath} className="text-sm font-semibold hover:underline" style={{ color: "var(--accent)" }}>
          ← 뒷풀이 보드로 돌아가기
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="grid gap-3 lg:h-[calc(100vh-3rem)] lg:grid-rows-[auto_auto_minmax(0,1fr)]">
          <section className="card-static w-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl tracking-tight" style={{ fontFamily: "var(--font-heading), sans-serif", color: "var(--ink)" }}>
                {afterparty.title}
              </h1>
              {afterparty.hasPassword ? (
                <span
                  className="inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold leading-none"
                  style={{ borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#b45309" }}
                >
                  비밀번호 설정
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
              {afterparty.location} · {formatStartTime(afterparty.startTime)}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
              현재 정산 참여자 {participants.length}명 · 현재 정산 미정산 {unsettledCount}명
            </p>
            <a
              href="#participant-quick-add"
              className="btn-press mt-3 inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold lg:hidden"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--accent)" }}
            >
              내 이름 빠르게 추가
            </a>

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

          <EditManageModal defaultOpen={Boolean(manageErrorMessage)}>
            <section
              className="mb-4 rounded-xl border p-4"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {afterparty.hasPassword ? "이 뒷풀이는 비밀번호 보호 중입니다." : "현재 뒷풀이 비밀번호가 없습니다."}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                {afterparty.hasPassword
                  ? "메모, 일정, 장소, 정산 정보, 삭제 같은 주요 메타데이터를 바꾸려면 현재 비밀번호가 필요합니다."
                  : "원하면 여기서 비밀번호를 추가해 이후 주요 메타데이터 수정과 삭제를 제한할 수 있습니다."}
              </p>
              {afterparty.hasPassword ? (
                <SharedFormPasswordField
                  label="현재 뒷풀이 비밀번호"
                  placeholder="한 번 입력하면 저장, 삭제, 정산 관리에 같이 사용돼요"
                  helperText="이 비밀번호는 이 모달의 저장/삭제/정산 작업에 함께 사용됩니다."
                  errorText={managePasswordFieldMessage}
                  className="mt-3"
                  targets={managePasswordTargets}
                />
              ) : null}
            </section>

            <section
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
            >
              <h3 className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>뒷풀이 정보 수정</h3>
              <form
                id="afterparty-update-form"
                action={updateAfterpartyAction}
                className="mt-3 grid gap-2 text-sm"
              >
                <input type="hidden" name="afterpartyId" value={afterparty.id} />
                <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <input
                  name="title"
                  required
                  defaultValue={afterparty.title}
                  className="h-10 rounded-lg border bg-white px-3"
                  style={{ borderColor: "var(--line)" }}
                />
                <input
                  name="location"
                  required
                  defaultValue={afterparty.location}
                  className="h-10 rounded-lg border bg-white px-3"
                  style={{ borderColor: "var(--line)" }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="eventDate"
                    type="date"
                    required
                    defaultValue={afterparty.eventDate}
                    className="h-10 rounded-lg border bg-white px-3"
                    style={{ borderColor: "var(--line)" }}
                  />
                  <input
                    name="startTime"
                    type="time"
                    required
                    defaultValue={afterparty.startTime}
                    className="h-10 rounded-lg border bg-white px-3"
                    style={{ borderColor: "var(--line)" }}
                  />
                </div>
                <input
                  name="description"
                  defaultValue={afterparty.description ?? ""}
                  className="h-10 rounded-lg border bg-white px-3"
                  style={{ borderColor: "var(--line)" }}
                  placeholder="메모"
                />
                <input
                  name="nextAfterpartyPassword"
                  type="password"
                  className="h-10 rounded-lg border bg-white px-3"
                  style={{ borderColor: "var(--line)" }}
                  placeholder={afterparty.hasPassword ? "새 비밀번호 (비워두면 유지)" : "관리 비밀번호 설정 (선택)"}
                  autoComplete="new-password"
                />
                {afterparty.hasPassword ? (
                  <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
                    <input type="checkbox" name="clearAfterpartyPassword" value="true" />
                    비밀번호 보호 해제
                  </label>
                ) : null}
                <button
                  type="submit"
                  className="btn-press h-10 rounded-lg text-sm font-semibold text-white md:w-28"
                  style={{ backgroundColor: "var(--ink)" }}
                >
                  정보 저장
                </button>
              </form>
            </section>

            <section
              className="mt-4 rounded-xl border p-4"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
            >
              <h3 className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>정산 관리</h3>

              <form
                id="afterparty-create-settlement-form"
                action={createAfterpartySettlementAction}
                className="mt-3 grid gap-2 text-sm md:grid-cols-12"
              >
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
                        {participantSearch ? <input type="hidden" name="participantSearch" value={participantSearch} /> : null}
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

                    <form
                      id={`afterparty-settlement-update-${settlement.id}`}
                      action={updateAfterpartySettlementAction}
                      className="grid gap-2 text-xs"
                    >
                      <input type="hidden" name="afterpartyId" value={afterparty.id} />
                      <input type="hidden" name="settlementId" value={settlement.id} />
                      <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <div className="grid gap-2 md:grid-cols-3">
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
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="btn-press h-8 rounded-lg border px-2 text-[11px] font-semibold"
                          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                        >
                          저장
                        </button>
                      </div>
                    </form>

                    {settlements.length > 1 ? (
                      <form
                        id={`afterparty-settlement-delete-${settlement.id}`}
                        action={deleteAfterpartySettlementAction}
                        className="mt-2 grid gap-2 text-xs"
                      >
                        <input type="hidden" name="afterpartyId" value={afterparty.id} />
                        <input type="hidden" name="settlementId" value={settlement.id} />
                        <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <div className="flex justify-end">
                          <DeleteConfirmButton
                            confirmMessage={`"${settlement.title}" 정산을 삭제합니다. 계속하시겠습니까?`}
                            className="btn-press h-8 rounded-lg border px-2 text-[11px] font-semibold"
                            style={{ borderColor: "#fecaca", color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
                          >
                            삭제
                          </DeleteConfirmButton>
                        </div>
                      </form>
                    ) : (
                      <span className="mt-2 block text-[10px]" style={{ color: "var(--ink-muted)" }}>
                        최소 1개 유지
                      </span>
                    )}
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
              <form
                id="afterparty-delete-form"
                action={deleteAfterpartyAction}
                className="mt-3 grid gap-2 text-sm"
              >
                <input type="hidden" name="afterpartyId" value={afterparty.id} />
                <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <DeleteConfirmButton
                  confirmMessage={`"${afterparty.title}" 뒷풀이와 모든 참여자 데이터가 삭제됩니다. 계속하시겠습니까?`}
                  className="btn-press h-9 rounded-lg px-3 text-xs font-semibold text-white md:w-36"
                  style={{ backgroundColor: "var(--danger)" }}
                >
                  이 뒷풀이 삭제
                </DeleteConfirmButton>
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
        <div id="participant-manual-add" className="scroll-mt-24" />
        {manualParticipantFeedback ? (
          <div className="mt-3">
            <ParticipantFeedbackBanner feedback={manualParticipantFeedback} />
          </div>
        ) : null}

        <form action={bulkCreateAfterpartyParticipantsAction} className="mt-3">
          <input type="hidden" name="afterpartyId" value={afterparty.id} />
          <input type="hidden" name="settlementId" value={selectedSettlement.id} />
          <input type="hidden" name="returnDate" value={date || afterparty.eventDate} />
          <input type="hidden" name="returnPath" value={manualReturnPath} />
          <input type="hidden" name="mutationSource" value="manual-add" />
          <div
            className="flex overflow-hidden rounded-md border bg-white"
            style={{ borderColor: manualParticipantFeedback ? "#fda4af" : "var(--line)" }}
          >
            <input
              name="names"
              defaultValue={manualParticipantDraft}
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
              placeholder="예: 김민수 또는 김민수, 박서준"
            />
            <PendingSubmitButton
              idleLabel="추가"
              pendingLabel="추가중..."
              className="btn-press h-11 shrink-0 border-l px-4 text-sm font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--accent)", backgroundColor: "var(--surface-alt)" }}
            />
          </div>
        </form>
        <div className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none"
            style={{ borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#2563eb" }}
            aria-hidden="true"
          >
            i
          </span>
          <p>
            직접 입력은 자동 역할 분류 없이 멤버로 추가됩니다. 여러 명은 쉼표로 구분해 입력하세요.
          </p>
        </div>

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

        <aside id="participant-quick-add" className="card-static scroll-mt-24 p-4 fade-in lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-hidden lg:flex lg:flex-col">
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>참여자</h2>
        <p className="mt-2 rounded-lg border border-dashed px-2.5 py-2 text-[11px]" style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}>
          팀/운영진 필터를 고른 뒤 이름을 클릭하면 선택된 정산에 바로 추가됩니다.
        </p>
        {quickParticipantFeedback ? (
          <div className="mt-3">
            <ParticipantFeedbackBanner feedback={quickParticipantFeedback} />
          </div>
        ) : null}

        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--ink-soft)" }}>
            <span>{assignRate}% 추가됨</span>
            <span>{assignedCount}/{totalAssignableCount}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-alt)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${assignRate}%`, backgroundColor: assignRate === 100 ? "var(--success)" : "var(--accent)" }} />
          </div>
        </div>

        <form
          action={`/afterparty/${afterpartyId}`}
          method="get"
          className="mt-3"
        >
          {date ? <input type="hidden" name="date" value={date} /> : null}
          <input type="hidden" name="settlement" value={selectedSettlement.id} />
          <div
            className="flex overflow-hidden rounded-md border bg-white"
            style={{ borderColor: "var(--line)" }}
          >
            <input
              name="participantSearch"
              defaultValue={participantSearch}
              className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
              placeholder="빠른추가 이름 검색"
            />
            <button
              type="submit"
              className="btn-press h-10 shrink-0 border-l px-3 text-sm font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface-alt)" }}
            >
              검색
            </button>
          </div>
        </form>

        <div className="mt-3">
          <QuerySelectFilter
            pathname={`/afterparty/${afterpartyId}`}
            paramName="team"
            selectedValue={teamFilter}
            params={{
              date,
              settlement: selectedSettlement.id,
            }}
            hash="participant-quick-add"
            options={[
              { label: "전체", value: "" },
              ...quickAddGroups.map((group) => ({
                label: group.teamName,
                value: group.teamName,
              })),
            ]}
          />
        </div>

        <div className="mt-3 grid gap-3 pr-1 stagger-children lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {participantSearch && visibleQuickAddGroups.length === 0 ? (
            <section
              className="rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
            >
              검색 결과가 없습니다. 팀 필터를 바꾸거나 이름 일부만 입력해 보세요.
            </section>
          ) : null}
          {visibleQuickAddGroups.map((group) => (
            <section key={`${group.kind}-${group.teamName}`} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{group.teamName}</p>
              <ul className="grid gap-1">
                {group.entries.map((entry) => {
                  const normalizedEntryName = normalizeName(entry.name);
                  const isAssigned = currentSettlementNames.has(normalizedEntryName);
                  return (
                    <li key={`${group.teamName}-${entry.role}-${entry.name}`} className="text-xs">
                      <QuickAddButton
                        afterpartyId={afterparty.id}
                        settlementId={selectedSettlement.id}
                        returnDate={date || afterparty.eventDate}
                        returnPath={quickAddReturnPath}
                        name={entry.name}
                        role={entry.role}
                        label={withTeamLabel(entry.name, teamLabelByMemberName)}
                        isAssigned={isAssigned}
                      />
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
