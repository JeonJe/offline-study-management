import type { ParticipantRole, RsvpRecord } from "@/lib/meetup-store";
import { normalizeMemberName, withTeamLabel } from "@/lib/member-label-utils";
import { PARTICIPANT_ROLE_ORDER } from "@/lib/participant-role-utils";
import { compareText } from "@/lib/sort-utils";

export function normalizeMeetingParticipantName(value: string): string {
  return normalizeMemberName(value);
}

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

export function compareTeamLabels(left: string, right: string): number {
  const leftOrder = teamOrderFromLabel(left);
  const rightOrder = teamOrderFromLabel(right);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return compareText(left, right);
}

export function sortRsvpsForRole(
  rows: RsvpRecord[],
  role: ParticipantRole,
  teamLabelByName: Map<string, string>
): RsvpRecord[] {
  const sorted = [...rows];
  if (role === "student") {
    sorted.sort((a, b) => {
      const teamA = teamLabelByName.get(normalizeMeetingParticipantName(a.name)) ?? "";
      const teamB = teamLabelByName.get(normalizeMeetingParticipantName(b.name)) ?? "";
      const teamDiff = compareTeamLabels(teamA, teamB);
      if (teamDiff !== 0) return teamDiff;

      return compareText(
        normalizeMeetingParticipantName(a.name),
        normalizeMeetingParticipantName(b.name)
      );
    });
    return sorted;
  }

  sorted.sort((a, b) => compareText(
    withTeamLabel(a.name, teamLabelByName),
    withTeamLabel(b.name, teamLabelByName)
  ));
  return sorted;
}

export function compareParticipantQuickAddEntries(
  left: { name: string; role: ParticipantRole },
  right: { name: string; role: ParticipantRole },
  teamLabelByName: Map<string, string>
): number {
  const roleDiff = roleOrderIndex(left.role) - roleOrderIndex(right.role);
  if (roleDiff !== 0) return roleDiff;

  const teamA = teamLabelByName.get(normalizeMeetingParticipantName(left.name)) ?? "";
  const teamB = teamLabelByName.get(normalizeMeetingParticipantName(right.name)) ?? "";
  const teamDiff = compareTeamLabels(teamA, teamB);
  if (teamDiff !== 0) return teamDiff;

  return compareText(
    normalizeMeetingParticipantName(left.name),
    normalizeMeetingParticipantName(right.name)
  );
}
