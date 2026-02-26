export function normalizeMemberName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/^\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function toTeamLabel(teamName: string): string {
  const trimmed = teamName.trim();
  if (!trimmed) {
    return "";
  }

  const teamNumberMatch = trimmed.match(/(\d+)\s*팀/);
  if (teamNumberMatch?.[1]) {
    return `${teamNumberMatch[1]}팀`;
  }

  return trimmed;
}

export function withTeamLabel(
  memberName: string,
  teamLabelByMemberName: Map<string, string>
): string {
  const teamLabel = teamLabelByMemberName.get(normalizeMemberName(memberName));
  if (!teamLabel) {
    return memberName;
  }

  const trimmed = memberName.trim();
  if (trimmed.startsWith(teamLabel)) {
    return memberName;
  }

  return `${teamLabel} ${memberName}`;
}
