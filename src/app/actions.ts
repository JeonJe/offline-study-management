"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAuthenticated, login, logout } from "@/lib/auth";
import { toKstIsoDate } from "@/lib/date-utils";
import { withSettlementInPath } from "@/lib/navigation-utils";
import {
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
  listMeetings,
  type ParticipantRole,
  updateMeeting,
  updateRsvp,
} from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";
import {
  buildRoleMatchSet,
  normalizeParticipantName,
  PARTICIPANT_ROLE_ORDER,
  resolveRoleByName,
} from "@/lib/participant-role-utils";

type DashboardState = {
  date?: string;
  keyword?: string;
};

function textFrom(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isParticipantRole(value: string): value is ParticipantRole {
  return (
    value === "student" ||
    value === "angel" ||
    value === "supporter" ||
    value === "buddy" ||
    value === "mentor" ||
    value === "manager"
  );
}

function normalizeMemberName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/^\d+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDelimitedNames(raw: string): string[] {
  const stopWords = new Set([
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

  const fromDelimiter = raw
    .split(/[\n,;<>|/，]+/)
    .map((chunk) => normalizeMemberName(chunk))
    .filter(Boolean)
    .filter((name) => !stopWords.has(name.toLowerCase()));

  const fromText = (raw.match(/[가-힣A-Za-z]{1,}(?:\s*\([^)]*\))?/g) ?? [])
    .map((chunk) => normalizeMemberName(chunk))
    .filter(Boolean)
    .filter((name) => !stopWords.has(name.toLowerCase()));

  return Array.from(new Set([...fromDelimiter, ...fromText]));
}

async function resolveMeetingLabel(meetingId: string): Promise<string> {
  const meetings = await listMeetings();
  const meeting = meetings.find((item) => item.id === meetingId);
  return meeting?.title ?? "";
}

async function resolveParticipantRoleEntries(
  names: string[]
): Promise<Array<{ name: string; role: ParticipantRole }>> {
  const memberPreset = await loadMemberPreset();
  const angelSet = new Set<string>([
    ...memberPreset.fixedAngels.map((name) => normalizeParticipantName(name)),
    ...memberPreset.teamGroups.map((team) => normalizeParticipantName(team.angel)),
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

  redirect(dashboardPath({ date: toKstIsoDate(new Date()) }));
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

  if (!title || !meetingDate || !location) {
    redirect(dashboardPath(state));
  }

  const created = await createMeeting({
    title,
    meetingDate,
    startTime,
    location,
    description,
  });

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

  revalidatePath("/");
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
  });

  revalidatePath("/afterparty");
  redirect(afterpartyPath({ date: created.eventDate }));
}

export async function bulkCreateAfterpartyParticipantsAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const settlementId = textFrom(formData, "settlementId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  const namesRaw = textFrom(formData, "names");
  const roleRaw = textFrom(formData, "role").trim();
  const names = parseDelimitedNames(namesRaw);

  if (!afterpartyId || names.length === 0) {
    redirect(afterpartyPath({ date }));
  }

  const participantInputs =
    isParticipantRole(roleRaw)
      ? names.map((name) => ({ name, role: roleRaw }))
      : await resolveParticipantRoleEntries(names);

  await createAfterpartyParticipantsBulk(
    afterpartyId,
    participantInputs,
    settlementId || undefined
  );

  revalidatePath("/afterparty");
  redirect(returnPath ?? afterpartyPath({ date }));
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

  revalidatePath("/afterparty");
  redirect(returnPath ?? afterpartyPath({ date }));
}

export async function deleteAfterpartyAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const date = textFrom(formData, "returnDate").trim();

  await requireAuthOrRedirect();

  if (!afterpartyId) {
    redirect(afterpartyPath({ date }));
  }

  await deleteAfterparty(afterpartyId);

  revalidatePath("/afterparty");
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

  if (!afterpartyId || !title || !eventDate || !startTime || !location) {
    redirect(afterpartyPath({ date }));
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    redirect(afterpartyPath({ date }));
  }

  await updateAfterparty({
    id: afterpartyId,
    title,
    eventDate,
    startTime,
    location,
    description,
  });

  revalidatePath("/afterparty");
  redirect(returnPath ?? afterpartyPath({ date: eventDate }));
}

export async function createAfterpartySettlementAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const title = textFrom(formData, "title").trim();
  const settlementManager = textFrom(formData, "settlementManager").trim();
  const settlementAccount = textFrom(formData, "settlementAccount").trim();

  await requireAuthOrRedirect();

  if (!afterpartyId || !title) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  const created = await createAfterpartySettlement({
    afterpartyId,
    title,
    settlementManager,
    settlementAccount,
  });

  revalidatePath("/afterparty");
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

  await requireAuthOrRedirect();

  if (!afterpartyId || !settlementId || !title) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  await updateAfterpartySettlement({
    id: settlementId,
    afterpartyId,
    title,
    settlementManager,
    settlementAccount,
  });

  revalidatePath("/afterparty");
  redirect(withSettlementInPath(returnPath, afterpartyId, settlementId, date));
}

export async function deleteAfterpartySettlementAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const settlementId = textFrom(formData, "settlementId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  if (!afterpartyId || !settlementId) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  try {
    const remainingSettlementId = await deleteAfterpartySettlement(settlementId, afterpartyId);
    revalidatePath("/afterparty");
    redirect(withSettlementInPath(returnPath, afterpartyId, remainingSettlementId, date));
  } catch {
    revalidatePath("/afterparty");
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

  revalidatePath("/");
  redirect(returnPath ?? dashboardPath({ date, keyword }));
}

export async function bulkCreateRsvpsAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const keyword = textFrom(formData, "returnKeyword").trim();
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  const namesRaw = textFrom(formData, "names");
  const roleRaw = textFrom(formData, "role").trim();
  const note = textFrom(formData, "note").trim();
  const meetingLabel = (await resolveMeetingLabel(meetingId)) || note;

  if (!meetingId) {
    redirect(dashboardPath({ date, keyword }));
  }

  const names = parseDelimitedNames(namesRaw);
  if (names.length === 0) {
    redirect(dashboardPath({ date, keyword }));
  }

  if (isParticipantRole(roleRaw)) {
    await createRsvpsBulk(meetingId, roleRaw, names, meetingLabel);
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
        await createRsvpsBulk(meetingId, role, namesByRole, meetingLabel);
      }
    }
  }

  revalidatePath("/");
  redirect(returnPath ?? dashboardPath({ date, keyword }));
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

  if (!meetingId || !title || !meetingDate || !startTime || !location) {
    redirect(dashboardPath({ date, keyword }));
  }

  await updateMeeting({
    id: meetingId,
    title,
    meetingDate,
    startTime,
    location,
    description,
  });

  revalidatePath("/");
  redirect(returnPath ?? dashboardPath({ date: meetingDate, keyword }));
}

export async function deleteMeetingAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const date = textFrom(formData, "returnDate").trim();

  await requireAuthOrRedirect();

  if (!meetingId) {
    redirect(dashboardPath({ date }));
  }

  await deleteMeeting(meetingId);

  revalidatePath("/");
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

  revalidatePath("/");
  redirect(returnPath ?? dashboardPath({ date, keyword }));
}
