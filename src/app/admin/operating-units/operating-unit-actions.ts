"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isGlobalAuthenticated } from "@/lib/auth";
import {
  createOperatingUnit,
  setOperatingUnitAccessCode,
  updateOperatingUnit,
} from "@/lib/operating-unit-store";
import {
  getCurrentRolePageRole,
  verifyRolePagePassword,
} from "@/lib/role-session";

function textFrom(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireAdminMutation(
  formData: FormData,
  invalidPasswordRedirect = "/admin/operating-units?unit=password-invalid"
): Promise<void> {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const currentRole = await getCurrentRolePageRole();
  if (currentRole !== "admin") {
    redirect("/admin?access=required");
  }

  if (!verifyRolePagePassword("admin", textFrom(formData, "adminPassword"))) {
    redirect(invalidPasswordRedirect);
  }
}

export async function createOperatingUnitAction(formData: FormData): Promise<void> {
  await requireAdminMutation(formData);

  const unit = await createOperatingUnit({
    slug: textFrom(formData, "slug"),
    name: textFrom(formData, "name"),
    description: textFrom(formData, "description"),
  });

  revalidatePath("/admin");
  revalidatePath("/admin/operating-units");
  redirect(`/admin/operating-units/${encodeURIComponent(unit.slug)}/edit?unit=created`);
}

export async function updateOperatingUnitAction(formData: FormData): Promise<void> {
  await requireAdminMutation(formData);

  const slug = textFrom(formData, "slug");
  await updateOperatingUnit({
    slug,
    name: textFrom(formData, "name"),
    description: textFrom(formData, "description"),
    isActive: textFrom(formData, "isActive") === "true",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/operating-units");
  revalidatePath(`/admin/operating-units/${encodeURIComponent(slug)}/edit`);
  redirect(`/admin/operating-units/${encodeURIComponent(slug)}/edit?unit=updated`);
}

export async function updateOperatingUnitAccessCodeAction(
  formData: FormData
): Promise<void> {
  const slug = textFrom(formData, "slug");
  const editPath = `/admin/operating-units/${encodeURIComponent(slug)}/edit`;

  await requireAdminMutation(formData, `${editPath}?unit=password-invalid`);

  const password = textFrom(formData, "accessPassword").trim();
  if (!password) {
    redirect(`${editPath}?unit=access-code-required`);
  }

  await setOperatingUnitAccessCode({
    slug,
    password,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/operating-units");
  revalidatePath(editPath);
  redirect(`${editPath}?unit=access-code-updated`);
}
