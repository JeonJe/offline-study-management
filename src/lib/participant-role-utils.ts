import type { ParticipantRole } from "@/lib/meetup-store";

export const SPECIAL_ROLE_PRESET: Record<
  Extract<ParticipantRole, "supporter" | "buddy" | "mentor" | "manager">,
  readonly string[]
> = {
  supporter: ["엄준서", "박기현"],
  buddy: ["김지웅", "변상일"],
  mentor: ["alen", "devin", "len", "kev"],
  manager: ["annie"],
} as const;

export type SpecialRolePresetInput = Partial<
  Record<keyof typeof SPECIAL_ROLE_PRESET, readonly string[]>
>;
export type RoleMatchSet = Record<keyof typeof SPECIAL_ROLE_PRESET, Set<string>>;

export type RoleMeta = {
  label: string;
  emoji: string;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
};

export const PARTICIPANT_ROLE_META: Record<ParticipantRole, RoleMeta> = {
  student: {
    label: "멤버",
    emoji: "",
    borderColor: "var(--line)",
    backgroundColor: "var(--surface)",
    textColor: "var(--ink-soft)",
  },
  angel: {
    label: "엔젤",
    emoji: "🪽",
    borderColor: "var(--angel-border)",
    backgroundColor: "var(--angel-bg)",
    textColor: "var(--angel-text)",
  },
  supporter: {
    label: "서포터",
    emoji: "💪",
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    textColor: "#1d4ed8",
  },
  buddy: {
    label: "버디",
    emoji: "🐥",
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
    textColor: "#15803d",
  },
  mentor: {
    label: "멘토",
    emoji: "👑",
    borderColor: "#d8b4fe",
    backgroundColor: "#faf5ff",
    textColor: "#7e22ce",
  },
  manager: {
    label: "매니저",
    emoji: "🧑‍💼",
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
    textColor: "#0f766e",
  },
};

export const PARTICIPANT_ROLE_ORDER: ParticipantRole[] = [
  "mentor",
  "manager",
  "angel",
  "supporter",
  "buddy",
  "student",
];

export function isParticipantRole(value: string): value is ParticipantRole {
  return PARTICIPANT_ROLE_ORDER.includes(value as ParticipantRole);
}

export function normalizeParticipantName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:\d+\s*팀\s*)+/i, "")
    .replace(/^\d+\s*/, "")
    .trim()
    .toLowerCase();
}

export function resolveRoleByName(
  name: string,
  angelSet: Set<string>,
  roleMatchSet: RoleMatchSet = DEFAULT_ROLE_MATCH_SET
): ParticipantRole {
  const normalized = normalizeParticipantName(name);
  const mentorSet = roleMatchSet.mentor;
  if (mentorSet.has(normalized)) return "mentor";

  const managerSet = roleMatchSet.manager;
  if (managerSet.has(normalized)) return "manager";

  if (angelSet.has(normalized)) return "angel";

  const supporterSet = roleMatchSet.supporter;
  if (supporterSet.has(normalized)) return "supporter";

  const buddySet = roleMatchSet.buddy;
  if (buddySet.has(normalized)) return "buddy";

  return "student";
}

export function buildRoleMatchSet(specialRoles?: SpecialRolePresetInput): RoleMatchSet {
  return {
    supporter: new Set(
      (specialRoles?.supporter ?? SPECIAL_ROLE_PRESET.supporter).map(normalizeParticipantName)
    ),
    buddy: new Set(
      (specialRoles?.buddy ?? SPECIAL_ROLE_PRESET.buddy).map(normalizeParticipantName)
    ),
    mentor: new Set(
      (specialRoles?.mentor ?? SPECIAL_ROLE_PRESET.mentor).map(normalizeParticipantName)
    ),
    manager: new Set(
      (specialRoles?.manager ?? SPECIAL_ROLE_PRESET.manager).map(normalizeParticipantName)
    ),
  };
}

const DEFAULT_ROLE_MATCH_SET: RoleMatchSet = buildRoleMatchSet();
