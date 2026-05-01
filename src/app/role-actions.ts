"use server";

import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import {
  clearRolePageAccess,
  grantRolePageAccess,
} from "@/lib/role-session";
import { normalizeRolePageRole } from "@/lib/role-page";

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function loginRoleAction(formData: FormData): Promise<void> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const role = normalizeRolePageRole(stringValue(formData.get("role")));
  const password = stringValue(formData.get("password"));

  if (!role || role === "member") {
    redirect("/member");
  }

  const granted = await grantRolePageAccess(role, password);
  if (!granted) {
    redirect(`/${role}?access=invalid`);
  }

  redirect(`/${role}`);
}

export async function logoutRoleAction(): Promise<void> {
  await clearRolePageAccess();
  redirect("/member");
}
