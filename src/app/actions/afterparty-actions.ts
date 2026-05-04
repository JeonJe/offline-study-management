"use server";

import { redirect } from "next/navigation";
import { isAuthenticatedForUnit } from "@/lib/auth";
import { withSettlementInPath } from "@/lib/navigation-utils";
import { requireOperatingUnitSlug } from "@/lib/operating-unit-store";
import {
  getAfterpartyById,
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
import { isParticipantRole } from "@/lib/participant-role-utils";
import {
  afterpartyManagePath,
  afterpartyPath,
  type DashboardState,
  parseDelimitedNames,
  parseDirectParticipantNames,
  participantFeedbackPath,
  participantFeedbackSourceFromMutation,
  revalidateAfterpartyViews,
  requireUnitAuthOrRedirect,
  resolveAfterpartyUnitOrRedirect,
  resolveParticipantRoleEntries,
  safeReturnPath,
  textFrom,
  withUpdatedSearchParams,
} from "@/app/actions/shared-action-utils";

export async function createAfterpartyAction(formData: FormData): Promise<void> {
  const state: DashboardState = {
    date: textFrom(formData, "returnDate"),
  };
  const returnPath = safeReturnPath(formData);

  const title = textFrom(formData, "title").trim();
  const eventDate = textFrom(formData, "eventDate").trim();
  const startTime = textFrom(formData, "startTime").trim() || "19:00";
  const location = textFrom(formData, "location").trim();
  const description = textFrom(formData, "description").trim();
  const settlementManager = textFrom(formData, "settlementManager").trim();
  const settlementAccount = textFrom(formData, "settlementAccount").trim();
  const password = textFrom(formData, "afterpartyPassword").trim();
  const operatingUnitSlug = requireOperatingUnitSlug(textFrom(formData, "unit"));

  await requireUnitAuthOrRedirect(operatingUnitSlug, returnPath);

  if (!title || !eventDate || !location) {
    redirect(returnPath ?? afterpartyPath(state));
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    redirect(returnPath ?? afterpartyPath(state));
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
    operatingUnitSlug,
  });

  revalidateAfterpartyViews(created.id, returnPath);
  redirect(
    returnPath
      ? withUpdatedSearchParams(returnPath, { date: created.eventDate })
      : afterpartyPath({ date: created.eventDate })
  );
}

export async function bulkCreateAfterpartyParticipantsAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const settlementId = textFrom(formData, "settlementId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const mutationSource = textFrom(formData, "mutationSource").trim();
  const feedbackSource = participantFeedbackSourceFromMutation(mutationSource);

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

  const targetUnitSlug = await resolveAfterpartyUnitOrRedirect(afterpartyId, fallbackPath);
  await requireUnitAuthOrRedirect(targetUnitSlug, fallbackPath);

  const participantInputs =
    feedbackSource === "manual"
      ? names.map((name) => ({
          name,
          role: isParticipantRole(roleRaw) ? roleRaw : ("student" as const),
        }))
      : isParticipantRole(roleRaw)
        ? names.map((name) => ({ name, role: roleRaw }))
        : await resolveParticipantRoleEntries(names, targetUnitSlug);

  const insertedCount = await createAfterpartyParticipantsBulk(
    afterpartyId,
    participantInputs,
    settlementId || undefined,
    { operatingUnitSlug: targetUnitSlug }
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

  if (!afterpartyId || !participantId) {
    redirect(afterpartyPath({ date }));
  }

  const fallbackPath = returnPath ?? afterpartyPath({ date });
  const targetUnitSlug = await resolveAfterpartyUnitOrRedirect(afterpartyId, fallbackPath);
  await requireUnitAuthOrRedirect(targetUnitSlug, fallbackPath);

  if (settlementId) {
    await deleteAfterpartySettlementParticipant(participantId, settlementId, afterpartyId, targetUnitSlug);
  } else {
    await deleteAfterpartyParticipant(participantId, afterpartyId, targetUnitSlug);
  }

  revalidateAfterpartyViews(afterpartyId, returnPath);
  redirect(returnPath ?? afterpartyPath({ date }));
}

export async function updateSettlementAction(
  participantId: string,
  afterpartyId: string,
  settlementId: string | undefined,
  isSettled: boolean
): Promise<{ ok: boolean }> {
  const afterparty = afterpartyId ? await getAfterpartyById(afterpartyId) : null;
  if (!afterparty) {
    return { ok: false };
  }
  const targetUnitSlug = requireOperatingUnitSlug(afterparty.operatingUnitSlug);
  const authenticated = await isAuthenticatedForUnit(targetUnitSlug);
  if (!authenticated) return { ok: false };

  try {
    await updateAfterpartyParticipantSettlement(
      participantId,
      afterpartyId,
      settlementId,
      isSettled,
      targetUnitSlug
    );
    revalidateAfterpartyViews(afterpartyId, null);
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

  if (!afterpartyId || !settlementId || !participantId) {
    redirect(afterpartyPath({ date }));
  }

  const fallbackPath = returnPath ?? afterpartyPath({ date });
  const targetUnitSlug = await resolveAfterpartyUnitOrRedirect(afterpartyId, fallbackPath);
  await requireUnitAuthOrRedirect(targetUnitSlug, fallbackPath);

  await updateAfterpartyParticipantSettlement(
    participantId,
    afterpartyId,
    settlementId,
    settledValue === "true",
    targetUnitSlug
  );

  revalidateAfterpartyViews(afterpartyId, returnPath);
  redirect(returnPath ?? afterpartyPath({ date }));
}

export async function deleteAfterpartyAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);
  const accessPassword = textFrom(formData, "afterpartyPassword").trim();

  if (!afterpartyId) {
    redirect(afterpartyPath({ date }));
  }

  const fallbackPath = returnPath ?? afterpartyPath({ date });
  const targetUnitSlug = await resolveAfterpartyUnitOrRedirect(afterpartyId, fallbackPath);
  await requireUnitAuthOrRedirect(targetUnitSlug, fallbackPath);

  try {
    await deleteAfterparty(afterpartyId, accessPassword, targetUnitSlug);
  } catch (error) {
    if (isAfterpartyPasswordError(error)) {
      redirect(afterpartyManagePath(afterpartyId, returnPath, error.code));
    }
    throw error;
  }

  revalidateAfterpartyViews(afterpartyId, returnPath);
  redirect(returnPath ?? afterpartyPath({ date }));
}

export async function updateAfterpartyAction(formData: FormData): Promise<void> {
  const afterpartyId = textFrom(formData, "afterpartyId").trim();
  const date = textFrom(formData, "returnDate").trim();
  const returnPath = safeReturnPath(formData);

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

  const fallbackPath = returnPath ?? afterpartyPath({ date });
  const targetUnitSlug = await resolveAfterpartyUnitOrRedirect(afterpartyId, fallbackPath);
  await requireUnitAuthOrRedirect(targetUnitSlug, fallbackPath);

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
      operatingUnitSlug: targetUnitSlug,
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

  if (!afterpartyId || !title) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  const fallbackPath = returnPath ?? afterpartyPath({ date });
  const targetUnitSlug = await resolveAfterpartyUnitOrRedirect(afterpartyId, fallbackPath);
  await requireUnitAuthOrRedirect(targetUnitSlug, fallbackPath);

  let created: Awaited<ReturnType<typeof createAfterpartySettlement>>;
  try {
    created = await createAfterpartySettlement({
      afterpartyId,
      title,
      settlementManager,
      settlementAccount,
      accessPassword,
      operatingUnitSlug: targetUnitSlug,
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

  if (!afterpartyId || !settlementId || !title) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  const fallbackPath = returnPath ?? afterpartyPath({ date });
  const targetUnitSlug = await resolveAfterpartyUnitOrRedirect(afterpartyId, fallbackPath);
  await requireUnitAuthOrRedirect(targetUnitSlug, fallbackPath);

  try {
    await updateAfterpartySettlement({
      id: settlementId,
      afterpartyId,
      title,
      settlementManager,
      settlementAccount,
      accessPassword,
      operatingUnitSlug: targetUnitSlug,
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

  if (!afterpartyId || !settlementId) {
    redirect(returnPath ?? afterpartyPath({ date }));
  }

  const fallbackPath = returnPath ?? afterpartyPath({ date });
  const targetUnitSlug = await resolveAfterpartyUnitOrRedirect(afterpartyId, fallbackPath);
  await requireUnitAuthOrRedirect(targetUnitSlug, fallbackPath);

  try {
    const remainingSettlementId = await deleteAfterpartySettlement(
      settlementId,
      afterpartyId,
      accessPassword,
      targetUnitSlug
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
