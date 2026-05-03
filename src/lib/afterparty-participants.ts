import type {
  AfterpartyParticipant,
} from "@/lib/afterparty-store";
import { normalizeMemberName, withTeamLabel } from "@/lib/member-label-utils";
import type { MemberPreset } from "@/lib/member-store";
import type { ParticipantRole } from "@/lib/meetup-store";
import {
  normalizeParticipantName,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";
import { compareText } from "@/lib/sort-utils";

export type AfterpartyQuickAddEntry = {
  name: string;
  role: ParticipantRole;
};

export type AfterpartyQuickAddGroup = {
  kind: "team" | "operation";
  teamName: string;
  entries: AfterpartyQuickAddEntry[];
};

export type AfterpartyParticipantState = {
  settledCount: number;
  unsettledCount: number;
  teamLabelByMemberName: Map<string, string>;
  currentSettlementNames: Set<string>;
  sortedParticipantRows: AfterpartyParticipant[];
  quickAddGroups: AfterpartyQuickAddGroup[];
  visibleQuickAddGroups: AfterpartyQuickAddGroup[];
  totalAssignableCount: number;
  assignedCount: number;
  assignRate: number;
};

type RoleByName = Map<string, Exclude<ParticipantRole, "student">>;

export function teamOrderFromLabel(teamLabel: string): number {
  const matched = teamLabel.match(/(\d+)\s*팀/);
  if (!matched?.[1]) return Number.POSITIVE_INFINITY;
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

export function roleOrderIndex(role: ParticipantRole): number {
  const index = PARTICIPANT_ROLE_ORDER.indexOf(role);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function compareTeamLabels(left: string, right: string): number {
  const leftOrder = teamOrderFromLabel(left);
  const rightOrder = teamOrderFromLabel(right);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return compareText(left, right);
}

function buildTeamLabelByMemberName(teamGroups: MemberPreset["teamGroups"]): Map<string, string> {
  const teamLabelByMemberName = new Map<string, string>();

  for (const group of teamGroups) {
    const teamLabel = group.teamName.trim();
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

  return teamLabelByMemberName;
}

function buildRoleByName(memberPreset: MemberPreset): RoleByName {
  const operationRoleOrder = PARTICIPANT_ROLE_ORDER.filter(
    (role): role is Exclude<ParticipantRole, "student"> => role !== "student"
  );
  const roleByName: RoleByName = new Map();

  for (const role of operationRoleOrder) {
    const candidates =
      role === "angel"
        ? [...memberPreset.teamGroups.flatMap((group) => group.angels), ...memberPreset.fixedAngels]
        : memberPreset.specialRoles[role] ?? [];

    for (const rawName of candidates) {
      const name = rawName.trim();
      if (!name) continue;

      const normalized = normalizeParticipantName(name);
      if (!roleByName.has(normalized)) {
        roleByName.set(normalized, role);
      }
    }
  }

  return roleByName;
}

export function compareAfterpartyQuickAddEntries(
  left: AfterpartyQuickAddEntry,
  right: AfterpartyQuickAddEntry,
  teamLabelByMemberName: Map<string, string>
): number {
  const roleDiff = roleOrderIndex(left.role) - roleOrderIndex(right.role);
  if (roleDiff !== 0) return roleDiff;

  const teamA = teamLabelByMemberName.get(normalizeMemberName(left.name)) ?? "";
  const teamB = teamLabelByMemberName.get(normalizeMemberName(right.name)) ?? "";
  const teamDiff = compareTeamLabels(teamA, teamB);
  if (teamDiff !== 0) return teamDiff;

  return compareText(normalizeMemberName(left.name), normalizeMemberName(right.name));
}

export function sortAfterpartyParticipantsForRole(
  rows: AfterpartyParticipant[],
  role: ParticipantRole,
  teamLabelByMemberName: Map<string, string>
): AfterpartyParticipant[] {
  const sorted = [...rows];
  if (role === "student") {
    sorted.sort((a, b) => {
      const teamA = teamLabelByMemberName.get(normalizeMemberName(a.name)) ?? "";
      const teamB = teamLabelByMemberName.get(normalizeMemberName(b.name)) ?? "";
      const teamDiff = compareTeamLabels(teamA, teamB);
      if (teamDiff !== 0) return teamDiff;

      return compareText(normalizeMemberName(a.name), normalizeMemberName(b.name));
    });
    return sorted;
  }

  sorted.sort((a, b) =>
    compareText(
      withTeamLabel(a.name, teamLabelByMemberName),
      withTeamLabel(b.name, teamLabelByMemberName)
    )
  );
  return sorted;
}

function buildOperationEntries(
  memberPreset: MemberPreset,
  teamLabelByMemberName: Map<string, string>
): AfterpartyQuickAddEntry[] {
  const operationRoleOrder = PARTICIPANT_ROLE_ORDER.filter(
    (role): role is Exclude<ParticipantRole, "student"> => role !== "student"
  );
  const operationNamesByRole = new Map<Exclude<ParticipantRole, "student">, string[]>();
  for (const role of operationRoleOrder) {
    operationNamesByRole.set(role, []);
  }
  const seenOperationNames = new Set<string>();

  for (const role of operationRoleOrder) {
    const candidates =
      role === "angel"
        ? [...memberPreset.teamGroups.flatMap((group) => group.angels), ...memberPreset.fixedAngels]
        : memberPreset.specialRoles[role] ?? [];

    for (const rawName of candidates) {
      const name = rawName.trim();
      if (!name) continue;

      const normalized = normalizeParticipantName(name);
      if (seenOperationNames.has(normalized)) continue;
      seenOperationNames.add(normalized);

      const bucket = operationNamesByRole.get(role) ?? [];
      bucket.push(name);
      operationNamesByRole.set(role, bucket);
    }
  }

  return operationRoleOrder
    .flatMap((role) =>
      (operationNamesByRole.get(role) ?? []).map((name) => ({
        name,
        role,
      }))
    )
    .sort((left, right) => compareAfterpartyQuickAddEntries(left, right, teamLabelByMemberName));
}

function buildQuickAddGroups(
  memberPreset: MemberPreset,
  roleByName: RoleByName,
  teamLabelByMemberName: Map<string, string>
): AfterpartyQuickAddGroup[] {
  const groups: AfterpartyQuickAddGroup[] = [
    ...memberPreset.teamGroups.map((team) => ({
      kind: "team" as const,
      teamName: team.teamName,
      entries: team.members
        .map((name) => ({
          name,
          role: roleByName.get(normalizeParticipantName(name)) ?? ("student" as const),
        }))
        .sort((left, right) => compareAfterpartyQuickAddEntries(left, right, teamLabelByMemberName)),
    })),
  ];

  const operationEntries = buildOperationEntries(memberPreset, teamLabelByMemberName);
  if (operationEntries.length > 0) {
    groups.push({
      kind: "operation",
      teamName: "운영진",
      entries: operationEntries,
    });
  }

  return groups;
}

function filterQuickAddGroups(
  groups: AfterpartyQuickAddGroup[],
  participantSearch: string,
  teamFilter: string,
  teamLabelByMemberName: Map<string, string>
): AfterpartyQuickAddGroup[] {
  const normalizedParticipantSearch = normalizeParticipantName(participantSearch);
  const filteredByTeam = teamFilter
    ? groups.filter((group) => group.teamName === teamFilter)
    : groups;

  return filteredByTeam
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => {
        if (!normalizedParticipantSearch) return true;
        const displayName = withTeamLabel(entry.name, teamLabelByMemberName);
        return (
          normalizeParticipantName(entry.name).includes(normalizedParticipantSearch) ||
          normalizeParticipantName(displayName).includes(normalizedParticipantSearch)
        );
      }),
    }))
    .filter((group) => group.entries.length > 0);
}

export function buildAfterpartyParticipantState(
  participants: AfterpartyParticipant[],
  memberPreset: MemberPreset,
  participantSearch: string,
  teamFilter: string
): AfterpartyParticipantState {
  const teamLabelByMemberName = buildTeamLabelByMemberName(memberPreset.teamGroups);
  const roleByName = buildRoleByName(memberPreset);
  const currentSettlementNames = new Set(
    participants.map((participant) => normalizeParticipantName(participant.name))
  );

  const displayParticipants = participants.map((participant) => {
    const resolvedRole = roleByName.get(normalizeParticipantName(participant.name));
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
      sortAfterpartyParticipantsForRole(participantsByRole.get(role) ?? [], role, teamLabelByMemberName)
    );
  }

  const sortedParticipantRows = PARTICIPANT_ROLE_ORDER.flatMap(
    (role) => participantsByRole.get(role) ?? []
  );
  const quickAddGroups = buildQuickAddGroups(memberPreset, roleByName, teamLabelByMemberName);
  const visibleQuickAddGroups = filterQuickAddGroups(
    quickAddGroups,
    participantSearch,
    teamFilter,
    teamLabelByMemberName
  );
  const totalAssignableCount = visibleQuickAddGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0
  );
  const assignedCount = visibleQuickAddGroups.reduce(
    (sum, group) =>
      sum +
      group.entries.filter((entry) => currentSettlementNames.has(normalizeParticipantName(entry.name))).length,
    0
  );
  const assignRate = totalAssignableCount > 0 ? Math.round((assignedCount / totalAssignableCount) * 100) : 0;
  const settledCount = participants.filter((participant) => participant.isSettled).length;
  const unsettledCount = Math.max(participants.length - settledCount, 0);

  return {
    settledCount,
    unsettledCount,
    teamLabelByMemberName,
    currentSettlementNames,
    sortedParticipantRows,
    quickAddGroups,
    visibleQuickAddGroups,
    totalAssignableCount,
    assignedCount,
    assignRate,
  };
}
