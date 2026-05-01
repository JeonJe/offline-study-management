export const MEETING_KIND = {
  study: "study",
  loopPak: "loop-pak",
} as const;

export type MeetingKind = (typeof MEETING_KIND)[keyof typeof MEETING_KIND];

export function normalizeMeetingKind(value: string | null | undefined): MeetingKind {
  return value === MEETING_KIND.loopPak ? MEETING_KIND.loopPak : MEETING_KIND.study;
}
