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
} from "@/lib/role-session";

function textFrom(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireAdminMutation(): Promise<void> {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const currentRole = await getCurrentRolePageRole();
  if (currentRole !== "admin") {
    redirect("/admin?access=required");
  }
}

export async function createOperatingUnitAction(formData: FormData): Promise<void> {
  await requireAdminMutation();

  const accessPassword = textFrom(formData, "accessPassword").trim();
  if (!accessPassword) {
    redirect("/admin/operating-units/new?unit=access-code-required");
  }

  const unit = await createOperatingUnit({
    slug: textFrom(formData, "slug"),
    name: textFrom(formData, "name"),
    description: textFrom(formData, "description"),
    accessPassword,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/operating-units");
  redirect(`/admin/operating-units/${encodeURIComponent(unit.slug)}/edit?unit=created`);
}

export async function updateOperatingUnitAction(formData: FormData): Promise<void> {
  await requireAdminMutation();

  const slug = textFrom(formData, "slug");
  await updateOperatingUnit({
    slug,
    name: textFrom(formData, "name"),
    description: textFrom(formData, "description"),
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

  await requireAdminMutation();

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
