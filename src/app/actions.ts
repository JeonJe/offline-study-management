"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { isAuthenticated, login, logout } from "@/lib/auth";
import { withSettlementInPath } from "@/lib/navigation-utils";
import {
  isAfterpartyPasswordError,
  createAfterparty,
  createAfterpartySettlement,
  createAfterpartyParticipantsBulk,
  deleteAfterparty,
  deleteAfterpartyParticipant,
  deleteAfterpartySettlement,
  deleteAfterpartySettlementParticipant,
  updateAfterpartyParticipantSettlement,
  updateAfterparty,
  updateAfterpartySettlement,
} from "@/lib/afterparty-store";
import {
  createMeeting,
  createRsvp,
  createRsvpsBulk,
  deleteMeeting,
  deleteRsvp,
  getMeetingTitle,
  isMeetingPasswordError,
  type ParticipantRole,
  updateMeeting,
  updateRsvp,
} from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";
import {
  buildRoleMatchSet,
  isParticipantRole,
  normalizeParticipantName,
  PARTICIPANT_ROLE_ORDER,
  resolveRoleByName,
} from "@/lib/participant-role-utils";

type DashboardState = {
  date?: string;
  keyword?: string;
};

type ParticipantAddFeedbackStatus = "invalid-input" | "already-added";
type ParticipantAddFeedbackSource = "manual" | "quick";

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

function textFrom(formData: FormData, key: string): string {
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

function parseDelimitedNames(raw: string): string[] {
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

function parseDelimitedPeople(raw: string): string[] {
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

function parseDirectParticipantNames(raw: string): string[] {
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

async function resolveMeetingLabel(meetingId: string): Promise<string> {
  return getMeetingTitle(meetingId);
}

async function resolveParticipantRoleEntries(
  names: string[]
): Promise<Array<{ name: string; role: ParticipantRole }>> {
  const memberPreset = await loadMemberPreset();
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

function dashboardPath(state: DashboardState = {}): string {
  const params = new URLSearchParams();
  const selectedDate = state.date?.trim();
  const keyword = state.keyword?.trim();

  if (selectedDate) params.set("date", selectedDate);
  if (keyword) params.set("q", keyword);

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function afterpartyPath(state: DashboardState = {}): string {
  const params = new URLSearchParams();
  const selectedDate = state.date?.trim();

  if (selectedDate) params.set("date", selectedDate);

  const query = params.toString();
  return query ? `/afterparty?${query}` : "/afterparty";
}

function safeReturnPath(formData: FormData): string | null {
  const raw = textFrom(formData, "returnPath").trim();
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/\\")) return null;
  return raw;
}

function withUpdatedSearchParams(
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

function meetingManagePath(meetingId: string, returnPath: string | null, status: string): string {
  return withUpdatedSearchParams(returnPath ?? `/meetings/${meetingId}`, {
    manage: status,
  });
}

function afterpartyManagePath(
  afterpartyId: string,
  returnPath: string | null,
  status: string
): string {
  return withUpdatedSearchParams(returnPath ?? `/afterparty/${afterpartyId}`, {
    manage: status,
  });
}

function participantFeedbackSourceFromMutation(
  mutationSource: string
): ParticipantAddFeedbackSource {
  return mutationSource === "quick-add" || mutationSource === "quick-assign"
    ? "quick"
    : "manual";
}

function participantFeedbackPath(
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

function revalidateMeetupViews(
  meetingId: string,
  returnPath: string | null,
  options?: { skipDashboardPath?: boolean }
): void {
  revalidateTag("meetup-data", { expire: 300 });
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

function revalidateAfterpartyViews(
  afterpartyId: string,
  returnPath: string | null,
  options?: { skipDashboardPath?: boolean }
): void {
  revalidateTag("afterparty-data", { expire: 300 });
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

async function requireAuthOrRedirect(): Promise<void> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = textFrom(formData, "password").trim();
  const success = await login(password);

  if (!success) {
    redirect("/?auth=invalid");
  }

  redirect(dashboardPath());
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/");
}

export async function createMeetingAction(formData: FormData): Promise<void> {
  const state: DashboardState = {
    date: textFrom(formData, "returnDate"),
    keyword: textFrom(formData, "returnKeyword"),
  };

  await requireAuthOrRedirect();

  const title = textFrom(formData, "title").trim();
  const meetingDate = textFrom(formData, "meetingDate").trim();
  const startTime = textFrom(formData, "startTime").trim() || "14:00";
  const location = textFrom(formData, "location").trim();
  const description = textFrom(formData, "description").trim();
  const leaders = parseDelimitedPeople(textFrom(formData, "leaders"));
  const password = textFrom(formData, "meetingPassword").trim();

  if (!title || !meetingDate || !location) {
    redirect(dashboardPath(state));
  }

  const created = await createMeeting({
    title,
    meetingDate,
    startTime,
    location,
    description,
    leaders,
    password,
  });

  revalidateTag("meetup-data", { expire: 300 });
  revalidatePath("/");
  redirect(dashboardPath({ date: created.meetingDate }));
}

export async function createRsvpAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const keyword = textFrom(formData, "returnKeyword").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  const name = textFrom(formData, "name").trim();
  const roleRaw = textFrom(formData, "role").trim();
  const meetingLabel = await resolveMeetingLabel(meetingId);

  if (!meetingId || !name || !isParticipantRole(roleRaw)) {
    redirect(dashboardPath({ date, keyword }));
  }

  await createRsvp({
    meetingId,
    name,
    role: roleRaw,
    note: meetingLabel,
  });

  revalidateMeetupViews(meetingId, returnPath);
  redirect(returnPath ?? dashboardPath({ date, keyword }));
}

export async function createAfterpartyAction(formData: FormData): Promise<void> {
  const state: DashboardState = {
    date: textFrom(formData, "returnDate"),
  };

  await requireAuthOrRedirect();

  const title = textFrom(formData, "title").trim();
  const eventDate = textFrom(formData, "eventDate").trim();
  const startTime = textFrom(formData, "startTime").trim() || "19:00";
  const location = textFrom(formData, "location").trim();
  const description = textFrom(formData, "description").trim();
  const settlementManager = textFrom(formData, "settlementManager").trim();
  const settlementAccount = textFrom(formData, "settlementAccount").trim();
  const password = textFrom(formData, "afterpartyPassword").trim();

  if (!title || !eventDate || !location) {
    redirect(afterpartyPath(state));
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    redirect(afterpartyPath(state));
  }

  const created = await createAfterparty({
    title,
    eventDate,
    startTime,
    location,
    description,
    settlementManager,
    settlementAccount,
    password,
  });

  revalidateTag("afterparty-data", { expire: 300 });
  revalidatePath("/afterparty");
  redirect(afterpartyPath({ date: created.eventDate }));
}

export async function bulkCreateAfterpartyParticipantsAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const settlementId = textFrom(formData, "settlementId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const mutationSource = textFrom(formData, "mutationSource").trim();
  const feedbackSource = participantFeedbackSourceFromMutation(mutationSource);

  await requireAuthOrRedirect();

  const namesRaw = textFrom(formData, "names");
  const roleRaw = textFrom(formData, "role").trim();
  const fallbackPath = returnPath ?? (afterpartyId ? `/afterparty/${afterpartyId}` : afterpartyPath({ date }));
  const names =
    feedbackSource === "manual"
      ? parseDirectParticipantNames(namesRaw)
      : parseDelimitedNames(namesRaw);

  if (!afterpartyId || names.length === 0) {
    redirect(participantFeedbackPath(fallbackPath, "invalid-input", feedbackSource, namesRaw));
  }

  const participantInputs =
    feedbackSource === "manual"
      ? names.map((name) => ({
          name,
          role: isParticipantRole(roleRaw) ? roleRaw : ("student" as const),
        }))
      : isParticipantRole(roleRaw)
        ? names.map((name) => ({ name, role: roleRaw }))
        : await resolveParticipantRoleEntries(names);

  const insertedCount = await createAfterpartyParticipantsBulk(
    afterpartyId,
    participantInputs,
    settlementId || undefined
  );

  if (insertedCount === 0) {
    redirect(participantFeedbackPath(fallbackPath, "already-added", feedbackSource, namesRaw));
  }

  revalidateAfterpartyViews(afterpartyId, returnPath, {
    skipDashboardPath: mutationSource === "quick-add",
  });
  redirect(fallbackPath);
}

export async function deleteAfterpartyParticipantAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const settlementId = textFrom(formData, "settlementId").trim();
  const participantId = textFrom(formData, "participantId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  if (!afterpartyId || !participantId) {
    redirect(afterpartyPath({ date }));
  }

  if (settlementId) {
    await deleteAfterpartySettlementParticipant(participantId, settlementId, afterpartyId);
  } else {
    await deleteAfterpartyParticipant(participantId, afterpartyId);
  }

  revalidateTag("afterparty-data", { expire: 300 });
  revalidatePath("/afterparty");
  redirect(returnPath ?? afterpartyPath({ date }));
}

export async function updateSettlementAction(
  participantId: string,
  afterpartyId: string,
  settlementId: string | undefined,
  isSettled: boolean
): Promise<{ ok: boolean }> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return { ok: false };
  }
  try {
    await updateAfterpartyParticipantSettlement(
      participantId,
      afterpartyId,
      settlementId,
      isSettled
    );
    revalidateTag("afterparty-data", { expire: 300 });
    revalidatePath("/afterparty");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function updateAfterpartyParticipantSettlementAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const settlementId = textFrom(formData, "settlementId").trim();
  const participantId = textFrom(formData, "participantId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const settledValue = textFrom(formData, "isSettled").trim();

  await requireAuthOrRedirect();

  if (!afterpartyId || !settlementId || !participantId) {
    redirect(afterpartyPath({ date }));
  }

  await updateAfterpartyParticipantSettlement(
    participantId,
    afterpartyId,
    settlementId,
    settledValue === "true"
  );

  revalidateTag("afterparty-data", { expire: 300 });
  revalidatePath("/afterparty");
  redirect(returnPath ?? afterpartyPath({ date }));
}

export async function deleteAfterpartyAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const accessPassword = textFrom(formData, "afterpartyPassword").trim();

  await requireAuthOrRedirect();

  if (!afterpartyId) {
    redirect(afterpartyPath({ date }));
  }

  try {
    await deleteAfterparty(afterpartyId, accessPassword);
  } catch (error) {
    if (isAfterpartyPasswordError(error)) {
      redirect(afterpartyManagePath(afterpartyId, returnPath, error.code));
    }
    throw error;
  }

  revalidateAfterpartyViews(afterpartyId, null);
  redirect(afterpartyPath({ date }));
}

export async function updateAfterpartyAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  const title = textFrom(formData, "title").trim();
  const eventDate = textFrom(formData, "eventDate").trim();
  const startTime = textFrom(formData, "startTime").trim();
  const location = textFrom(formData, "location").trim();
  const description = textFrom(formData, "description").trim();
  const accessPassword = textFrom(formData, "afterpartyPassword").trim();
  const nextPassword = textFrom(formData, "nextAfterpartyPassword").trim();
  const clearPassword = textFrom(formData, "clearAfterpartyPassword") === "true";

  if (!afterpartyId || !title || !eventDate || !startTime || !location) {
    redirect(afterpartyPath({ date }));
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    redirect(afterpartyPath({ date }));
  }

  try {
    await updateAfterparty({
      id: afterpartyId,
      title,
      eventDate,
      startTime,
      location,
      description,
      accessPassword,
      nextPassword,
      clearPassword,
    });
  } catch (error) {
    if (isAfterpartyPasswordError(error)) {
      redirect(afterpartyManagePath(afterpartyId, returnPath, error.code));
    }
    throw error;
  }

  revalidateAfterpartyViews(afterpartyId, returnPath);
  redirect(returnPath ?? afterpartyPath({ date: eventDate }));
}

export async function createAfterpartySettlementAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const title = textFrom(formData, "title").trim();
  const settlementManager = textFrom(formData, "settlementManager").trim();
  const settlementAccount = textFrom(formData, "settlementAccount").trim();
  const accessPassword = textFrom(formData, "afterpartyPassword").trim();

  await requireAuthOrRedirect();

  if (!afterpartyId || !title) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  let created: Awaited<ReturnType<typeof createAfterpartySettlement>>;
  try {
    created = await createAfterpartySettlement({
      afterpartyId,
      title,
      settlementManager,
      settlementAccount,
      accessPassword,
    });
  } catch (error) {
    if (isAfterpartyPasswordError(error)) {
      redirect(afterpartyManagePath(afterpartyId, returnPath, error.code));
    }
    throw error;
  }

  revalidateAfterpartyViews(afterpartyId, returnPath);
  redirect(withSettlementInPath(returnPath, afterpartyId, created.id, date));
}

export async function updateAfterpartySettlementAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const settlementId = textFrom(formData, "settlementId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const title = textFrom(formData, "title").trim();
  const settlementManager = textFrom(formData, "settlementManager").trim();
  const settlementAccount = textFrom(formData, "settlementAccount").trim();
  const accessPassword = textFrom(formData, "afterpartyPassword").trim();

  await requireAuthOrRedirect();

  if (!afterpartyId || !settlementId || !title) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  try {
    await updateAfterpartySettlement({
      id: settlementId,
      afterpartyId,
      title,
      settlementManager,
      settlementAccount,
      accessPassword,
    });
  } catch (error) {
    if (isAfterpartyPasswordError(error)) {
      redirect(afterpartyManagePath(afterpartyId, returnPath, error.code));
    }
    throw error;
  }

  revalidateAfterpartyViews(afterpartyId, returnPath);
  redirect(withSettlementInPath(returnPath, afterpartyId, settlementId, date));
}

export async function deleteAfterpartySettlementAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const settlementId = textFrom(formData, "settlementId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const accessPassword = textFrom(formData, "afterpartyPassword").trim();

  await requireAuthOrRedirect();

  if (!afterpartyId || !settlementId) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  try {
    const remainingSettlementId = await deleteAfterpartySettlement(
      settlementId,
      afterpartyId,
      accessPassword
    );
    revalidateAfterpartyViews(afterpartyId, returnPath);
    redirect(withSettlementInPath(returnPath, afterpartyId, remainingSettlementId, date));
  } catch (error) {
    if (isAfterpartyPasswordError(error)) {
      redirect(afterpartyManagePath(afterpartyId, returnPath, error.code));
    }
    revalidateAfterpartyViews(afterpartyId, returnPath);
    redirect(returnPath ?? afterpartyPath({ date }));
  }
}

export async function deleteRsvpAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const keyword = textFrom(formData, "returnKeyword").trim();
  const rsvpId = textFrom(formData, "rsvpId").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  if (!meetingId || !rsvpId) {
    redirect(dashboardPath({ date, keyword }));
  }

  await deleteRsvp(rsvpId, meetingId);

  revalidateMeetupViews(meetingId, returnPath);
  redirect(returnPath ?? dashboardPath({ date, keyword }));
}

export async function bulkCreateRsvpsAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const keyword = textFrom(formData, "returnKeyword").trim();
  const returnPath = safeReturnPath(formData);
  const mutationSource = textFrom(formData, "mutationSource").trim();
  const feedbackSource = participantFeedbackSourceFromMutation(mutationSource);

  await requireAuthOrRedirect();

  const namesRaw = textFrom(formData, "names");
  const roleRaw = textFrom(formData, "role").trim();
  const note = textFrom(formData, "note").trim();
  const meetingLabel = note || (await resolveMeetingLabel(meetingId));
  const fallbackPath = returnPath ?? (meetingId ? `/meetings/${meetingId}` : dashboardPath({ date, keyword }));

  if (!meetingId) {
    redirect(dashboardPath({ date, keyword }));
  }

  const names =
    feedbackSource === "manual"
      ? parseDirectParticipantNames(namesRaw)
      : parseDelimitedNames(namesRaw);
  if (names.length === 0) {
    redirect(participantFeedbackPath(fallbackPath, "invalid-input", feedbackSource, namesRaw));
  }

  let insertedCount = 0;
  if (isParticipantRole(roleRaw)) {
    insertedCount = await createRsvpsBulk(meetingId, roleRaw, names, meetingLabel);
  } else {
    const roleEntries = await resolveParticipantRoleEntries(names);

    const roleBuckets = new Map<ParticipantRole, string[]>();
    for (const role of PARTICIPANT_ROLE_ORDER) {
      roleBuckets.set(role, []);
    }

    for (const entry of roleEntries) {
      const bucket = roleBuckets.get(entry.role) ?? [];
      bucket.push(entry.name);
      roleBuckets.set(entry.role, bucket);
    }

    for (const role of PARTICIPANT_ROLE_ORDER) {
      const namesByRole = roleBuckets.get(role) ?? [];
      if (namesByRole.length > 0) {
        insertedCount += await createRsvpsBulk(meetingId, role, namesByRole, meetingLabel);
      }
    }
  }

  if (insertedCount === 0) {
    redirect(participantFeedbackPath(fallbackPath, "already-added", feedbackSource, namesRaw));
  }

  revalidateMeetupViews(meetingId, returnPath, {
    skipDashboardPath: mutationSource === "quick-assign",
  });
  redirect(fallbackPath);
}

export async function updateMeetingAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const keyword = textFrom(formData, "returnKeyword").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  const title = textFrom(formData, "title").trim();
  const meetingDate = textFrom(formData, "meetingDate").trim();
  const startTime = textFrom(formData, "startTime").trim();
  const location = textFrom(formData, "location").trim();
  const description = textFrom(formData, "description").trim();
  const leaders = parseDelimitedPeople(textFrom(formData, "leaders"));
  const accessPassword = textFrom(formData, "meetingPassword").trim();
  const nextPassword = textFrom(formData, "nextMeetingPassword").trim();
  const clearPassword = textFrom(formData, "clearMeetingPassword") === "true";

  if (!meetingId || !title || !meetingDate || !startTime || !location) {
    redirect(dashboardPath({ date, keyword }));
  }

  try {
    await updateMeeting({
      id: meetingId,
      title,
      meetingDate,
      startTime,
      location,
      description,
      leaders,
      accessPassword,
      nextPassword,
      clearPassword,
    });
  } catch (error) {
    if (isMeetingPasswordError(error)) {
      redirect(meetingManagePath(meetingId, returnPath, error.code));
    }
    throw error;
  }

  revalidateMeetupViews(meetingId, returnPath);
  redirect(returnPath ?? dashboardPath({ date: meetingDate, keyword }));
}

export async function deleteMeetingAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const accessPassword = textFrom(formData, "meetingPassword").trim();

  await requireAuthOrRedirect();

  if (!meetingId) {
    redirect(dashboardPath({ date }));
  }

  try {
    await deleteMeeting(meetingId, accessPassword);
  } catch (error) {
    if (isMeetingPasswordError(error)) {
      redirect(meetingManagePath(meetingId, returnPath, error.code));
    }
    throw error;
  }

  revalidateMeetupViews(meetingId, null);
  redirect(dashboardPath({ date }));
}

export async function updateRsvpAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const rsvpId = textFrom(formData, "rsvpId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const keyword = textFrom(formData, "returnKeyword").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  const name = textFrom(formData, "name").trim();
  const roleRaw = textFrom(formData, "role").trim();
  const note = textFrom(formData, "note").trim();

  if (!meetingId || !rsvpId || !name || !isParticipantRole(roleRaw)) {
    redirect(dashboardPath({ date, keyword }));
  }

  await updateRsvp({
    id: rsvpId,
    meetingId,
    name,
    role: roleRaw,
    note,
  });

  revalidateMeetupViews(meetingId, returnPath);
  redirect(returnPath ?? dashboardPath({ date, keyword }));
}
