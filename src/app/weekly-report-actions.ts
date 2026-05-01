"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import {
  createWeeklyReportCycle,
  createWeeklyReportTemplate,
  deleteWeeklyReportTemplate,
  addComment,
  listComments,
  softDeleteComment,
  updateWeeklyReportTemplate,
  updateWeeklyReportCycle,
  upsertAngelWeeklyReport,
} from "@/lib/weekly-report-store";
import type { WeeklyReportCommentAuthorRole } from "@/lib/weekly-report-store";
import {
  getCurrentRolePageRole,
  verifyRoleScopedToken,
} from "@/lib/role-session";
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

async function requireRole(
  allowedRoles: RolePageRole[],
  fallbackPath: string
): Promise<void> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const currentRole = await getCurrentRolePageRole();
  if (!currentRole || !allowedRoles.includes(currentRole)) {
    redirect(fallbackPath);
  }
}

export async function createWeeklyReportCycleAction(formData: FormData): Promise<void> {
  await requireRole(["admin"], "/admin?access=required");

  await createWeeklyReportCycle({
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
  redirect("/admin/reports?report=created");
}

export async function updateWeeklyReportCycleAction(formData: FormData): Promise<void> {
  await requireRole(["admin"], "/admin?access=required");

  await updateWeeklyReportCycle({
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
  redirect("/admin/reports?report=updated");
}

export async function createWeeklyReportTemplateAction(formData: FormData): Promise<void> {
  await requireRole(["admin"], "/admin?access=required");
  const sectionTitles = textListFrom(formData, "sectionTitle");
  const sectionPrompts = textListFrom(formData, "sectionPrompt");

  await createWeeklyReportTemplate({
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
  redirect("/admin/reports?template=created");
}

export async function updateWeeklyReportTemplateAction(formData: FormData): Promise<void> {
  await requireRole(["admin"], "/admin?access=required");
  const templateId = textFrom(formData, "templateId");
  const sectionTitles = textListFrom(formData, "sectionTitle");
  const sectionPrompts = textListFrom(formData, "sectionPrompt");

  await updateWeeklyReportTemplate({
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
  redirect("/admin/reports?template=updated");
}

export async function deleteWeeklyReportTemplateAction(formData: FormData): Promise<void> {
  await requireRole(["admin"], "/admin?access=required");
  await deleteWeeklyReportTemplate(textFrom(formData, "templateId"));

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/angel");
  revalidatePath("/angel/reports");
  redirect("/admin/reports?template=deleted");
}

export async function submitAngelWeeklyReportAction(formData: FormData): Promise<void> {
  await requireRole(["angel", "admin"], "/angel?access=required");

  const cycleId = textFrom(formData, "cycleId");
  const returnPath = safeReturnPath(formData);

  await upsertAngelWeeklyReport({
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
  redirect(returnPath ? `${returnPath}?report=submitted` : `/angel/reports/${encodeURIComponent(cycleId)}?report=submitted`);
}

function commentAuthorRoleFromPageRole(
  role: RolePageRole | null
): WeeklyReportCommentAuthorRole {
  return role === "admin" ? "admin" : "angel";
}

export async function addWeeklyReportCommentAction(formData: FormData): Promise<void> {
  await requireRole(["angel", "admin"], "/angel?access=required");

  const currentRole = await getCurrentRolePageRole();
  const reportId = textFrom(formData, "reportId");
  const returnPath = safeReturnPath(formData);
  const authorRole = commentAuthorRoleFromPageRole(currentRole);
  const authorLabel =
    authorRole === "admin"
      ? "관리자"
      : textFrom(formData, "authorLabel");
  if (
    authorRole === "angel" &&
    !verifyRoleScopedToken(
      "angel",
      "weekly-report-comment-author",
      `${reportId}:${authorLabel}`,
      textFrom(formData, "authorToken")
    )
  ) {
    redirect(returnPath ? `${returnPath}?comment=forbidden` : "/angel/reports?comment=forbidden");
  }

  await addComment({
    reportId,
    authorRole,
    authorLabel,
    body: textFrom(formData, "body"),
  });

  revalidatePath("/angel");
  revalidatePath("/angel/reports");
  revalidatePath(returnPath ?? "/angel/reports");
  redirect(returnPath ? `${returnPath}?comment=created` : "/angel/reports?comment=created");
}

export async function deleteWeeklyReportCommentAction(formData: FormData): Promise<void> {
  await requireRole(["angel", "admin"], "/angel?access=required");

  const currentRole = await getCurrentRolePageRole();
  const commentId = textFrom(formData, "commentId");
  const reportId = textFrom(formData, "reportId");
  const returnPath = safeReturnPath(formData);
  const authorLabel = textFrom(formData, "authorLabel");
  const ownershipToken = textFrom(formData, "ownershipToken");
  const comments = await listComments(reportId);
  const target = comments.find((comment) => comment.id === commentId);

  if (!target) {
    redirect(returnPath ?? "/angel/reports");
  }

  const canDelete =
    currentRole === "admin" ||
    (currentRole === "angel" &&
      target.authorRole === "angel" &&
      target.authorLabel === authorLabel &&
      verifyRoleScopedToken(
        "angel",
        "weekly-report-comment-delete",
        `${reportId}:${commentId}:${authorLabel}`,
        ownershipToken
      ));

  if (!canDelete) {
    redirect(returnPath ? `${returnPath}?comment=forbidden` : "/angel/reports?comment=forbidden");
  }

  await softDeleteComment(commentId);

  revalidatePath("/angel");
  revalidatePath("/angel/reports");
  revalidatePath(returnPath ?? "/angel/reports");
  redirect(returnPath ? `${returnPath}?comment=deleted` : "/angel/reports?comment=deleted");
}
