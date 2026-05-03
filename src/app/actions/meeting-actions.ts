"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeMeetingKind } from "@/lib/meeting-kind";
import { requireOperatingUnitSlug } from "@/lib/operating-unit-store";
import {
  createMeeting,
  createRsvp,
  createRsvpsBulk,
  deleteMeeting,
  deleteRsvp,
  isMeetingPasswordError,
  parseCapacityInput,
  promoteWaitlistedRsvp,
  type ParticipantRole,
  updateMeeting,
  updateRsvp,
} from "@/lib/meetup-store";
import {
  isParticipantRole,
  PARTICIPANT_ROLE_ORDER,
} from "@/lib/participant-role-utils";
import {
  dashboardPath,
  type DashboardState,
  meetingManagePath,
  parseDelimitedNames,
  parseDelimitedPeople,
  parseDirectParticipantNames,
  participantFeedbackPath,
  participantFeedbackSourceFromMutation,
  revalidateMeetupViews,
  requireAuthOrRedirect,
  resolveMeetingLabel,
  resolveParticipantRoleEntries,
  safeReturnPath,
  textFrom,
  unitSlugFromPath,
} from "@/app/actions/shared-action-utils";

export async function createMeetingAction(formData: FormData): Promise<void> {
  const state: DashboardState = {
    date: textFrom(formData, "returnDate"),
    keyword: textFrom(formData, "returnKeyword"),
  };
  const returnPath = safeReturnPath(formData);

  await requireAuthOrRedirect();

  const title = textFrom(formData, "title").trim();
  const meetingDate = textFrom(formData, "meetingDate").trim();
  const startTime = textFrom(formData, "startTime").trim() || "14:00";
  const location = textFrom(formData, "location").trim();
  const description = textFrom(formData, "description").trim();
  const leaders = parseDelimitedPeople(textFrom(formData, "leaders"));
  const password = textFrom(formData, "meetingPassword").trim();
  const meetingKind = normalizeMeetingKind(textFrom(formData, "meetingKind").trim());
  const operatingUnitSlug = requireOperatingUnitSlug(textFrom(formData, "unit"));

  if (!title || !meetingDate || !location) {
    redirect(returnPath ?? dashboardPath(state));
  }

  const capacityResult = parseCapacityInput(textFrom(formData, "capacity"));
  const capacityValue =
    capacityResult.kind === "value" ? capacityResult.value : undefined;

  const created = await createMeeting({
    title,
    meetingDate,
    startTime,
    location,
    description,
    leaders,
    password,
    capacity: capacityValue,
    meetingKind,
    operatingUnitSlug,
  });

  revalidateMeetupViews(created.id, returnPath);
  revalidatePath("/loop-pak");
  redirect(returnPath ?? dashboardPath({ date: created.meetingDate }));
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

export async function promoteWaitlistedRsvpAction(formData: FormData): Promise<void> {
  const meetingId = textFrom(formData, "meetingId").trim();
  const rsvpId = textFrom(formData, "rsvpId").trim();
  const returnPath = safeReturnPath(formData);
  const fallbackPath = returnPath ?? (meetingId ? `/meetings/${meetingId}` : "/");

  await requireAuthOrRedirect();

  if (!meetingId || !rsvpId) {
    redirect(fallbackPath);
  }

  const promoted = await promoteWaitlistedRsvp(meetingId, rsvpId);
  if (!promoted) {
    redirect(participantFeedbackPath(fallbackPath, "waitlist-full", "manual"));
  }

  revalidateMeetupViews(meetingId, returnPath);
  redirect(fallbackPath);
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
    const roleEntries = await resolveParticipantRoleEntries(names, unitSlugFromPath(returnPath));

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
  const capacityResult = parseCapacityInput(textFrom(formData, "capacity"));

  if (!meetingId || !title || !meetingDate || !startTime || !location) {
    redirect(dashboardPath({ date, keyword }));
  }

  if (capacityResult.kind === "invalid") {
    redirect(meetingManagePath(meetingId, returnPath, "capacity-invalid"));
  }
  const capacity =
    capacityResult.kind === "value" ? capacityResult.value : null;

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
      capacity,
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

  revalidateMeetupViews(meetingId, returnPath);
  redirect(returnPath ?? dashboardPath({ date }));
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
