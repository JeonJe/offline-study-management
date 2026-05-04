"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  NEW_OPERATING_UNIT_PATH,
  OPERATING_UNITS_PATH,
  operatingUnitDetailPath,
  operatingUnitEditPath,
  withUnitStatus,
} from "@/app/admin/operating-units/operating-unit-routes";
import { isGlobalAuthenticated } from "@/lib/auth";
import {
  createOperatingUnit,
  deleteOperatingUnit,
  isProtectedOperatingUnitSlug,
  setOperatingUnitAccessCode,
  setOperatingUnitRoleCode,
  updateOperatingUnit,
} from "@/lib/operating-unit-store";

function textFrom(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireAdminMutation(): Promise<void> {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }
}

function revalidateOperatingUnitAdminViews(slug?: string): void {
  revalidatePath("/admin");
  revalidatePath(OPERATING_UNITS_PATH);
  if (!slug) return;

  revalidatePath(operatingUnitDetailPath(slug));
  revalidatePath(operatingUnitEditPath(slug));
}

export async function createOperatingUnitAction(formData: FormData): Promise<void> {
  await requireAdminMutation();

  const accessPassword = textFrom(formData, "accessPassword").trim();
  const angelPassword = textFrom(formData, "angelPassword").trim();
  const adminPassword = textFrom(formData, "adminPassword").trim();
  if (!accessPassword) {
    redirect(withUnitStatus(NEW_OPERATING_UNIT_PATH, "access-code-required"));
  }
  if (!angelPassword) {
    redirect(withUnitStatus(NEW_OPERATING_UNIT_PATH, "angel-code-required"));
  }
  if (!adminPassword) {
    redirect(withUnitStatus(NEW_OPERATING_UNIT_PATH, "admin-code-required"));
  }

  await createOperatingUnit({
    slug: textFrom(formData, "slug"),
    name: textFrom(formData, "name"),
    description: textFrom(formData, "description"),
    accessPassword,
    angelPassword,
    adminPassword,
  });

  revalidateOperatingUnitAdminViews();
  redirect(withUnitStatus(OPERATING_UNITS_PATH, "created"));
}

export async function updateOperatingUnitAction(formData: FormData): Promise<void> {
  await requireAdminMutation();

  const slug = textFrom(formData, "slug");
  await updateOperatingUnit({
    slug,
    name: textFrom(formData, "name"),
    description: textFrom(formData, "description"),
  });

  revalidateOperatingUnitAdminViews(slug);
  redirect(withUnitStatus(operatingUnitDetailPath(slug), "updated"));
}

export async function deleteOperatingUnitAction(formData: FormData): Promise<void> {
  const slug = textFrom(formData, "slug");
  const detailPath = operatingUnitDetailPath(slug);

  await requireAdminMutation();

  if (isProtectedOperatingUnitSlug(slug)) {
    redirect(withUnitStatus(detailPath, "delete-protected"));
  }

  await deleteOperatingUnit(slug);

  revalidateOperatingUnitAdminViews(slug);
  redirect(withUnitStatus(OPERATING_UNITS_PATH, "deleted"));
}

export async function updateOperatingUnitAccessCodeAction(
  formData: FormData
): Promise<void> {
  const slug = textFrom(formData, "slug");
  const editPath = operatingUnitEditPath(slug);

  await requireAdminMutation();

  const password = textFrom(formData, "accessPassword").trim();
  if (!password) {
    redirect(withUnitStatus(editPath, "access-code-required"));
  }

  await setOperatingUnitAccessCode({
    slug,
    password,
  });

  revalidateOperatingUnitAdminViews(slug);
  redirect(withUnitStatus(editPath, "access-code-updated"));
}

export async function updateOperatingUnitAngelCodeAction(
  formData: FormData
): Promise<void> {
  const slug = textFrom(formData, "slug");
  const editPath = operatingUnitEditPath(slug);

  await requireAdminMutation();

  const password = textFrom(formData, "angelPassword").trim();
  if (!password) {
    redirect(withUnitStatus(editPath, "angel-code-required"));
  }

  await setOperatingUnitRoleCode({
    slug,
    role: "angel",
    password,
  });

  revalidateOperatingUnitAdminViews(slug);
  redirect(withUnitStatus(editPath, "angel-code-updated"));
}

export async function updateOperatingUnitAdminCodeAction(
  formData: FormData
): Promise<void> {
  const slug = textFrom(formData, "slug");
  const editPath = operatingUnitEditPath(slug);

  await requireAdminMutation();

  const password = textFrom(formData, "adminPassword").trim();
  if (!password) {
    redirect(withUnitStatus(editPath, "admin-code-required"));
  }

  await setOperatingUnitRoleCode({
    slug,
    role: "admin",
    password,
  });

  revalidateOperatingUnitAdminViews(slug);
  redirect(withUnitStatus(editPath, "admin-code-updated"));
}
