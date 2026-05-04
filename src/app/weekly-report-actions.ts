"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAuthenticatedForUnit } from "@/lib/auth";
import { cohortAwarePath, cohortEntryLoginPath } from "@/lib/cohort-routes";
import { requireOperatingUnitSlug } from "@/lib/operating-unit-store";
import {
  createWeeklyReportCycle,
  createWeeklyReportTemplate,
  deleteAngelWeeklyReport,
  deleteWeeklyReportTemplate,
  updateWeeklyReportTemplate,
  updateWeeklyReportCycle,
  upsertAngelWeeklyReport,
} from "@/lib/weekly-report-store";
import { getCurrentRolePageRole } from "@/lib/role-session";
import type { RolePageRole } from "@/lib/role-page";

function textFrom(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function textListFrom(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string");
}

function safeReturnPath(formData: FormData): string | null {
  const raw = textFrom(formData, "returnPath").trim();
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/\\")) return null;
  return raw;
}

function appendQuery(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function operatingUnitSlugFromForm(formData: FormData): string {
  return requireOperatingUnitSlug(textFrom(formData, "unit"));
}

async function requireRole(
  unitSlug: string,
  allowedRoles: RolePageRole[],
  fallbackPath: string
): Promise<void> {
  const authenticated = await isAuthenticatedForUnit(unitSlug);
  if (!authenticated) {
    redirect(cohortEntryLoginPath(unitSlug, { auth: "required", returnPath: fallbackPath }));
  }

  const currentRole = await getCurrentRolePageRole(unitSlug);
  if (!currentRole || !allowedRoles.includes(currentRole)) {
    redirect(fallbackPath);
  }
}

export async function createWeeklyReportCycleAction(formData: FormData): Promise<void> {
  const operatingUnitSlug = operatingUnitSlugFromForm(formData);
  await requireRole(operatingUnitSlug, ["admin"], `${cohortAwarePath(operatingUnitSlug, "/admin/reports/cycles/new")}?access=required`);

  await createWeeklyReportCycle({
    operatingUnitSlug,
    templateId: textFrom(formData, "templateId"),
    title: textFrom(formData, "title"),
    weekLabel: textFrom(formData, "weekLabel"),
    startDate: textFrom(formData, "startDate"),
    dueDate: textFrom(formData, "dueDate"),
    prompt: textFrom(formData, "prompt"),
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/angel");
  redirect(`${cohortAwarePath(operatingUnitSlug, "/admin/reports")}?report=created`);
}

export async function updateWeeklyReportCycleAction(formData: FormData): Promise<void> {
  const operatingUnitSlug = operatingUnitSlugFromForm(formData);
  await requireRole(operatingUnitSlug, ["admin"], `${cohortAwarePath(operatingUnitSlug, "/admin/reports")}?access=required`);

  await updateWeeklyReportCycle({
    operatingUnitSlug,
    id: textFrom(formData, "cycleId"),
    templateId: textFrom(formData, "templateId"),
    title: textFrom(formData, "title"),
    weekLabel: textFrom(formData, "weekLabel"),
    startDate: textFrom(formData, "startDate"),
    dueDate: textFrom(formData, "dueDate"),
    prompt: textFrom(formData, "prompt"),
  });

  const cycleId = textFrom(formData, "cycleId");
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/cycles/${cycleId}/edit`);
  revalidatePath("/angel");
  revalidatePath("/angel/reports");
  revalidatePath(`/angel/reports/${cycleId}`);
  redirect(`${cohortAwarePath(operatingUnitSlug, "/admin/reports")}?report=updated`);
}

export async function createWeeklyReportTemplateAction(formData: FormData): Promise<void> {
  const operatingUnitSlug = operatingUnitSlugFromForm(formData);
  await requireRole(operatingUnitSlug, ["admin"], `${cohortAwarePath(operatingUnitSlug, "/admin/reports/templates/new")}?access=required`);
  const sectionTitles = textListFrom(formData, "sectionTitle");
  const sectionPrompts = textListFrom(formData, "sectionPrompt");

  await createWeeklyReportTemplate({
    operatingUnitSlug,
    name: textFrom(formData, "name"),
    prompt: textFrom(formData, "prompt"),
    sections: sectionTitles.map((title, index) => ({
      title,
      prompt: sectionPrompts[index] ?? "",
    })),
    summaryTitle: textFrom(formData, "summaryTitle"),
    summaryPrompt: textFrom(formData, "summaryPrompt"),
    notesTitle: textFrom(formData, "notesTitle"),
    notesPrompt: textFrom(formData, "notesPrompt"),
    requestsTitle: textFrom(formData, "requestsTitle"),
    requestsPrompt: textFrom(formData, "requestsPrompt"),
    actionItemsTitle: textFrom(formData, "actionItemsTitle"),
    actionItemsPrompt: textFrom(formData, "actionItemsPrompt"),
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  redirect(`${cohortAwarePath(operatingUnitSlug, "/admin/reports")}?template=created`);
}

export async function updateWeeklyReportTemplateAction(formData: FormData): Promise<void> {
  const operatingUnitSlug = operatingUnitSlugFromForm(formData);
  const templateId = textFrom(formData, "templateId");
  await requireRole(
    operatingUnitSlug,
    ["admin"],
    `${cohortAwarePath(operatingUnitSlug, `/admin/reports/templates/${encodeURIComponent(templateId)}/edit`)}?access=required`
  );
  const sectionTitles = textListFrom(formData, "sectionTitle");
  const sectionPrompts = textListFrom(formData, "sectionPrompt");

  await updateWeeklyReportTemplate({
    operatingUnitSlug,
    id: templateId,
    name: textFrom(formData, "name"),
    prompt: textFrom(formData, "prompt"),
    sections: sectionTitles.map((title, index) => ({
      title,
      prompt: sectionPrompts[index] ?? "",
    })),
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/templates/${templateId}/edit`);
  revalidatePath("/angel");
  revalidatePath("/angel/reports");
  redirect(`${cohortAwarePath(operatingUnitSlug, "/admin/reports")}?template=updated`);
}

export async function deleteWeeklyReportTemplateAction(formData: FormData): Promise<void> {
  const operatingUnitSlug = operatingUnitSlugFromForm(formData);
  await requireRole(operatingUnitSlug, ["admin"], `${cohortAwarePath(operatingUnitSlug, "/admin/reports")}?access=required`);
  await deleteWeeklyReportTemplate(textFrom(formData, "templateId"), operatingUnitSlug);

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/angel");
  revalidatePath("/angel/reports");
  redirect(`${cohortAwarePath(operatingUnitSlug, "/admin/reports")}?template=deleted`);
}

export async function submitAngelWeeklyReportAction(formData: FormData): Promise<void> {
  const cycleId = textFrom(formData, "cycleId");
  const operatingUnitSlug = operatingUnitSlugFromForm(formData);
  const returnPath = safeReturnPath(formData);
  await requireRole(
    operatingUnitSlug,
    ["angel", "admin"],
    returnPath
      ? appendQuery(returnPath, "access", "required")
      : `${cohortAwarePath(operatingUnitSlug, "/angel")}?access=required`
  );

  await upsertAngelWeeklyReport({
    operatingUnitSlug,
    cycleId,
    angelName: textFrom(formData, "angelName"),
    teamName: textFrom(formData, "teamName"),
    summary: textFrom(formData, "summary"),
    notes: textFrom(formData, "notes"),
    requests: textFrom(formData, "requests"),
    actionItems: textFrom(formData, "actionItems"),
  });

  revalidatePath("/angel");
  revalidatePath("/angel/reports");
  revalidatePath(`/angel/reports/${cycleId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  redirect(returnPath ? appendQuery(returnPath, "report", "submitted") : `/angel/reports/${encodeURIComponent(cycleId)}?report=submitted`);
}

export async function deleteAngelWeeklyReportAction(formData: FormData): Promise<void> {
  const cycleId = textFrom(formData, "cycleId");
  const operatingUnitSlug = operatingUnitSlugFromForm(formData);
  const returnPath = safeReturnPath(formData);
  await requireRole(
    operatingUnitSlug,
    ["angel", "admin"],
    returnPath ? appendQuery(returnPath, "access", "required") : `${cohortAwarePath(operatingUnitSlug, "/angel")}?access=required`
  );

  await deleteAngelWeeklyReport(textFrom(formData, "reportId"), operatingUnitSlug);

  revalidatePath("/angel");
  revalidatePath("/angel/reports");
  revalidatePath(`/angel/reports/${cycleId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  redirect(returnPath ? appendQuery(returnPath, "report", "unsubmitted") : `/angel/reports/${encodeURIComponent(cycleId)}?report=unsubmitted`);
}
