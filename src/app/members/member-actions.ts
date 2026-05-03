"use server";

import { isAuthenticated } from "@/lib/auth";
import { revalidateMemberData } from "@/lib/cache-invalidation";
import { requireOperatingUnitSlug } from "@/lib/operating-unit-store";
import {
  saveMemberPresetToDb,
  SPECIAL_PARTICIPANT_ROLES,
  type SpecialParticipantRole,
  type TeamMemberEntry,
  type TeamMemberGroup,
} from "@/lib/member-store";

type SaveMemberPresetInput = {
  operatingUnitSlug?: unknown;
  fixedAngels?: unknown;
  teamGroups?: unknown;
  specialRoles?: unknown;
};

export type SaveMemberPresetResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "save-failed" };

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function parseNames(raw: string): string[] {
  return uniq(raw.split(/[\n,;]+/));
}

function parseMemberEntries(input: unknown): TeamMemberEntry[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, fallbackOrder) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { id?: unknown; name?: unknown; order?: unknown };
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const order = typeof row.order === "number" && Number.isFinite(row.order)
        ? row.order
        : fallbackOrder;

      if (!id || !name) return null;
      return { id, name, order };
    })
    .filter((row): row is TeamMemberEntry => row !== null);
}

function parsePayload(
  input: SaveMemberPresetInput
): {
  fixedAngels: string[];
  teamGroups: TeamMemberGroup[];
  specialRoles: Partial<Record<SpecialParticipantRole, string[]>>;
} | null {
  const fixedAngels = Array.isArray(input.fixedAngels)
    ? input.fixedAngels
        .filter((item): item is string => typeof item === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  const teamGroups = Array.isArray(input.teamGroups)
    ? input.teamGroups
        .map((item): TeamMemberGroup | null => {
          if (!item || typeof item !== "object") return null;
          const row = item as {
            teamName?: unknown;
            angel?: unknown;
            angels?: unknown;
            members?: unknown;
            memberEntries?: unknown;
          };
          const teamName = typeof row.teamName === "string" ? row.teamName.trim() : "";
          const angelsFromArray = Array.isArray(row.angels)
            ? row.angels
                .filter((angel): angel is string => typeof angel === "string")
                .map((angel) => angel.trim())
                .filter(Boolean)
            : [];
          const angelsFromLegacy = typeof row.angel === "string" ? parseNames(row.angel) : [];
          const angels = uniq([...(angelsFromArray.length > 0 ? angelsFromArray : angelsFromLegacy)]).slice(0, 2);
          const memberEntries = parseMemberEntries(row.memberEntries);
          const members = memberEntries.length > 0
            ? memberEntries.map((member) => member.name)
            : Array.isArray(row.members)
              ? row.members
                  .filter((member): member is string => typeof member === "string")
                  .map((member) => member.trim())
                  .filter(Boolean)
              : [];

          if (!teamName || angels.length === 0) return null;
          return { teamName, angels, members, memberEntries };
        })
        .filter((row): row is TeamMemberGroup => row !== null)
    : [];

  if (fixedAngels.length === 0 || teamGroups.length === 0) {
    return null;
  }

  const specialRoles: Partial<Record<SpecialParticipantRole, string[]>> = {};
  if (input.specialRoles && typeof input.specialRoles === "object" && !Array.isArray(input.specialRoles)) {
    const source = input.specialRoles as Partial<Record<SpecialParticipantRole, unknown>>;
    for (const role of SPECIAL_PARTICIPANT_ROLES) {
      const list = source[role];
      if (!Array.isArray(list)) continue;
      specialRoles[role] = list
        .filter((member): member is string => typeof member === "string")
        .map((member) => member.trim())
        .filter(Boolean);
    }
  }

  return { fixedAngels, teamGroups, specialRoles };
}

export async function saveMemberPresetAction(
  payload: SaveMemberPresetInput
): Promise<SaveMemberPresetResult> {
  const authed = await isAuthenticated();
  if (!authed) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = parsePayload(payload);
  if (!parsed) {
    return { ok: false, error: "invalid" };
  }
  const operatingUnitSlug =
    typeof payload.operatingUnitSlug === "string"
      ? payload.operatingUnitSlug
      : "";

  try {
    await saveMemberPresetToDb(
      requireOperatingUnitSlug(operatingUnitSlug),
      parsed.teamGroups,
      parsed.fixedAngels,
      parsed.specialRoles
    );
  } catch {
    return { ok: false, error: "save-failed" };
  }

  revalidateMemberData();
  return { ok: true };
}
