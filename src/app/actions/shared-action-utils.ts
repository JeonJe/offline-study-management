import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAuthenticated, isAuthenticatedForUnit } from "@/lib/auth";
import {
  revalidateAfterpartyData,
  revalidateMeetupData,
} from "@/lib/cache-invalidation";
import { cohortAwarePath, cohortEntryLoginPath } from "@/lib/cohort-routes";
import { getAfterpartyById } from "@/lib/afterparty-store";
import {
  getMeetingById,
  getMeetingTitle,
  type ParticipantRole,
} from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";
import { requireOperatingUnitSlug } from "@/lib/operating-unit-store";
import {
  buildRoleMatchSet,
  normalizeParticipantName,
  PARTICIPANT_ROLE_ORDER,
  resolveRoleByName,
} from "@/lib/participant-role-utils";
import type { RolePageRole } from "@/lib/role-page";
import { getCurrentRolePageRole } from "@/lib/role-session";

export type DashboardState = {
  date?: string;
  keyword?: string;
};

export type ParticipantAddFeedbackStatus = "invalid-input" | "already-added" | "waitlist-full";
export type ParticipantAddFeedbackSource = "manual" | "quick";

const PARTICIPANT_INPUT_STOP_WORDS = new Set([
  "이름",
  "엔젤",
  "학생",
  "멤버",
  "팀",
  "서포터",
  "버디",
  "멘토",
  "매니저",
  "supporter",
  "buddy",
  "mentor",
  "manager",
]);

export { PARTICIPANT_ROLE_ORDER };

export function textFrom(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeMemberName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/^(?:\d+\s*팀\s*)+/i, "")
    .replace(/^\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDelimitedNames(raw: string): string[] {
  const fromDelimiter = raw
    .split(/[\n,;<>|/，]+/)
    .map((chunk) => normalizeMemberName(chunk))
    .filter(Boolean)
    .filter((name) => !PARTICIPANT_INPUT_STOP_WORDS.has(name.toLowerCase()));

  const fromText = (raw.match(/[가-힣A-Za-z]{1,}(?:\s*\([^)]*\))?/g) ?? [])
    .map((chunk) => normalizeMemberName(chunk))
    .filter(Boolean)
    .filter((name) => !PARTICIPANT_INPUT_STOP_WORDS.has(name.toLowerCase()));

  return Array.from(new Set([...fromDelimiter, ...fromText]));
}

export function parseDelimitedPeople(raw: string): string[] {
  const unique = new Set<string>();
  const people: string[] = [];
  for (const token of raw.split(/[\n,;]+/)) {
    const name = token.trim();
    if (!name || unique.has(name)) continue;
    unique.add(name);
    people.push(name);
  }
  return people;
}

export function parseDirectParticipantNames(raw: string): string[] {
  const unique = new Set<string>();
  const people: string[] = [];
  for (const token of raw.split(/[\n,;]+/)) {
    const name = normalizeMemberName(token);
    if (!name || unique.has(name)) continue;
    if (PARTICIPANT_INPUT_STOP_WORDS.has(name.toLowerCase())) continue;
    unique.add(name);
    people.push(name);
  }
  return people;
}

export async function resolveMeetingLabel(meetingId: string): Promise<string> {
  return getMeetingTitle(meetingId);
}

export function unitSlugFromPath(path: string | null): string {
  const match = path?.match(/^\/cohorts\/([^/?#]+)/);
  return requireOperatingUnitSlug(match?.[1] ?? "");
}

export async function resolveParticipantRoleEntries(
  names: string[],
  operatingUnitSlug: string
): Promise<Array<{ name: string; role: ParticipantRole }>> {
  const memberPreset = await loadMemberPreset(operatingUnitSlug);
  const angelSet = new Set<string>([
    ...memberPreset.fixedAngels.map((name) => normalizeParticipantName(name)),
    ...memberPreset.teamGroups.flatMap((team) =>
      team.angels.map((angel) => normalizeParticipantName(angel))
    ),
  ]);
  const roleMatchSet = buildRoleMatchSet(memberPreset.specialRoles);

  return names.map((name) => ({
    name,
    role: resolveRoleByName(name, angelSet, roleMatchSet),
  }));
}

export function dashboardPath(state: DashboardState = {}): string {
  const params = new URLSearchParams();
  const selectedDate = state.date?.trim();
  const keyword = state.keyword?.trim();

  if (selectedDate) params.set("date", selectedDate);
  if (keyword) params.set("q", keyword);

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function afterpartyPath(state: DashboardState = {}): string {
  const params = new URLSearchParams();
  const selectedDate = state.date?.trim();

  if (selectedDate) params.set("date", selectedDate);

  const query = params.toString();
  return query ? `/afterparty?${query}` : "/afterparty";
}

export function cohortEntryPath(unitSlug: string): string {
  return unitSlug.trim() ? cohortAwarePath(unitSlug, "/") : dashboardPath();
}

export async function requireUnitAuthOrRedirect(
  unitSlug: string,
  returnPath?: string | null
): Promise<void> {
  const operatingUnitSlug = requireOperatingUnitSlug(unitSlug);
  const authenticated = await isAuthenticatedForUnit(operatingUnitSlug);
  if (authenticated) return;

  redirect(
    cohortEntryLoginPath(operatingUnitSlug, {
      auth: "required",
      returnPath: returnPath ?? cohortEntryPath(operatingUnitSlug),
    })
  );
}

export async function requireUnitRoleOrRedirect(
  unitSlug: string,
  allowedRoles: RolePageRole[],
  returnPath?: string | null
): Promise<void> {
  const operatingUnitSlug = requireOperatingUnitSlug(unitSlug);
  const fallbackPath = returnPath ?? cohortEntryPath(operatingUnitSlug);

  await requireUnitAuthOrRedirect(operatingUnitSlug, fallbackPath);

  const currentRole = await getCurrentRolePageRole(operatingUnitSlug);
  if (currentRole && allowedRoles.includes(currentRole)) return;

  redirect(withUpdatedSearchParams(fallbackPath, { access: "required" }));
}

export async function resolveMeetingUnitOrRedirect(
  meetingId: string,
  fallbackPath: string
): Promise<string> {
  const meeting = meetingId ? await getMeetingById(meetingId) : null;
  if (!meeting) {
    redirect(fallbackPath);
  }

  return requireOperatingUnitSlug(meeting.operatingUnitSlug);
}

export async function resolveAfterpartyUnitOrRedirect(
  afterpartyId: string,
  fallbackPath: string
): Promise<string> {
  const afterparty = afterpartyId ? await getAfterpartyById(afterpartyId) : null;
  if (!afterparty) {
    redirect(fallbackPath);
  }

  return requireOperatingUnitSlug(afterparty.operatingUnitSlug);
}

export function safeReturnPath(formData: FormData): string | null {
  const raw = textFrom(formData, "returnPath").trim();
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/\\")) return null;
  return raw;
}

export function withUpdatedSearchParams(
  path: string,
  updates: Record<string, string | null | undefined>
): string {
  const [pathPart, hashPart = ""] = path.split("#", 2);
  const [pathname, searchPart = ""] = pathPart.split("?", 2);
  const params = new URLSearchParams(searchPart);

  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hashPart ? `#${hashPart}` : ""}`;
}

export function meetingManagePath(meetingId: string, returnPath: string | null, status: string): string {
  return withUpdatedSearchParams(returnPath ?? `/meetings/${meetingId}`, {
    manage: status,
  });
}

export function afterpartyManagePath(
  afterpartyId: string,
  returnPath: string | null,
  status: string
): string {
  return withUpdatedSearchParams(returnPath ?? `/afterparty/${afterpartyId}`, {
    manage: status,
  });
}

export function participantFeedbackSourceFromMutation(
  mutationSource: string
): ParticipantAddFeedbackSource {
  return mutationSource === "quick-add" || mutationSource === "quick-assign"
    ? "quick"
    : "manual";
}

export function participantFeedbackPath(
  path: string,
  status: ParticipantAddFeedbackStatus,
  source: ParticipantAddFeedbackSource,
  rawInput?: string
): string {
  return withUpdatedSearchParams(path, {
    participantStatus: status,
    participantSource: source,
    participantDraft: rawInput?.trim() ? rawInput.trim().slice(0, 200) : null,
  });
}

function pathWithoutQueryAndHash(path: string | null): string | null {
  if (!path) return null;
  const hashRemoved = path.split("#")[0] ?? "";
  const pathname = hashRemoved.split("?")[0] ?? "";
  return pathname || null;
}

export function revalidateMeetupViews(
  meetingId: string,
  returnPath: string | null,
  options?: { skipDashboardPath?: boolean }
): void {
  revalidateMeetupData();
  if (!options?.skipDashboardPath) {
    revalidatePath("/");
  }
  if (meetingId) {
    revalidatePath(`/meetings/${meetingId}`);
  }

  const returnPathname = pathWithoutQueryAndHash(returnPath);
  if (
    returnPathname &&
    returnPathname !== "/" &&
    returnPathname !== `/meetings/${meetingId}`
  ) {
    revalidatePath(returnPathname);
  }
}

export function revalidateAfterpartyViews(
  afterpartyId: string,
  returnPath: string | null,
  options?: { skipDashboardPath?: boolean }
): void {
  revalidateAfterpartyData();
  if (!options?.skipDashboardPath) {
    revalidatePath("/afterparty");
  }
  if (afterpartyId) {
    revalidatePath(`/afterparty/${afterpartyId}`);
  }

  const returnPathname = pathWithoutQueryAndHash(returnPath);
  if (
    returnPathname &&
    returnPathname !== "/afterparty" &&
    returnPathname !== `/afterparty/${afterpartyId}`
  ) {
    revalidatePath(returnPathname);
  }
}

export async function requireAuthOrRedirect(): Promise<void> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }
}
