import type {
  AfterpartyParticipant,
  AfterpartySettlement,
  AfterpartySummary,
} from "@/lib/afterparty-store";
import type {
  MeetingSummary,
  RsvpRecord,
} from "@/lib/meetup-store";
import {
  PARTICIPANT_ROLE_META,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";
import { withTeamLabel } from "@/lib/member-label-utils";
import { sortText } from "@/lib/sort-utils";

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

function sortNames(names: string[]): string[] {
  return sortText(names);
}

export function buildOfflineStudyShareText({
  selectedDate,
  meetingsOnDate,
  rsvpsByMeeting,
  teamLabelByMemberName,
}: {
  selectedDate: string;
  meetingsOnDate: MeetingSummary[];
  rsvpsByMeeting: Record<string, RsvpRecord[]>;
  teamLabelByMemberName: Map<string, string>;
}): string {
  const lines: string[] = [];
  lines.push(`[오프라인 모임] ${selectedDate}`);
  lines.push(`총 ${meetingsOnDate.length}개 모임`);
  lines.push("");

  for (const [index, meeting] of meetingsOnDate.entries()) {
    const rsvps = rsvpsByMeeting[meeting.id] ?? [];

    lines.push(`${index + 1}. ${meeting.title}`);
    lines.push(`- 시간: ${formatStartTime(meeting.startTime)}`);
    lines.push(`- 장소: ${meeting.location}`);
    if (meeting.description) {
      lines.push(`- 메모: ${meeting.description}`);
    }
    lines.push(`- 참여: 총 ${meeting.totalCount}명`);

    for (const role of PARTICIPANT_ROLE_ORDER) {
      const roleMeta = PARTICIPANT_ROLE_META[role];
      const names = sortNames(
        rsvps
          .filter((row) => row.role === role)
          .map((row) => withTeamLabel(row.name, teamLabelByMemberName))
      );
      lines.push(`- ${roleMeta.label}: ${names.length > 0 ? names.join(", ") : "없음"}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function buildAfterpartyShareText({
  selectedDate,
  afterpartiesOnDate,
  participantsByAfterparty,
  settlementsByAfterparty,
  teamLabelByMemberName,
}: {
  selectedDate: string;
  afterpartiesOnDate: AfterpartySummary[];
  participantsByAfterparty: Record<string, AfterpartyParticipant[]>;
  settlementsByAfterparty: Record<string, AfterpartySettlement[]>;
  teamLabelByMemberName: Map<string, string>;
}): string {
  const lines: string[] = [];
  lines.push(`[뒷풀이] ${selectedDate}`);
  lines.push(`총 ${afterpartiesOnDate.length}개 모임`);
  lines.push("");

  for (const [index, afterparty] of afterpartiesOnDate.entries()) {
    const participants = participantsByAfterparty[afterparty.id] ?? [];
    const settlements = settlementsByAfterparty[afterparty.id] ?? [];

    lines.push(`${index + 1}. ${afterparty.title}`);
    lines.push(`- 시간: ${formatStartTime(afterparty.startTime)}`);
    lines.push(`- 장소: ${afterparty.location}`);
    if (afterparty.description) {
      lines.push(`- 메모: ${afterparty.description}`);
    }
    lines.push(`- 참여: 총 ${afterparty.participantCount}명`);

    for (const role of PARTICIPANT_ROLE_ORDER) {
      const roleMeta = PARTICIPANT_ROLE_META[role];
      const names = sortNames(
        participants
          .filter((row) => row.role === role)
          .map((row) => withTeamLabel(row.name, teamLabelByMemberName))
      );
      lines.push(`- ${roleMeta.label}: ${names.length > 0 ? names.join(", ") : "없음"}`);
    }

    if (settlements.length > 0) {
      for (const [settlementIndex, settlement] of settlements.entries()) {
        lines.push(
          `- 정산${settlementIndex + 1}: ${settlement.settlementManager || "미등록"} / ${settlement.settlementAccount || "계좌 미등록"}`
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
