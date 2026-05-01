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

function safeReturnPath(formData: FormData): string | null {
  const raw = stringValue(formData.get("returnPath")).trim();
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/\\")) return null;
  return raw;
}

export async function loginRoleAction(formData: FormData): Promise<void> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const role = normalizeRolePageRole(stringValue(formData.get("role")));
  const password = stringValue(formData.get("password"));
  const returnPath = safeReturnPath(formData);

  if (!role || role === "member") {
    redirect(returnPath ?? "/member");
  }

  const granted = await grantRolePageAccess(role, password);
  if (!granted) {
    redirect(returnPath ? `${returnPath}?access=invalid` : `/${role}?access=invalid`);
  }

  redirect(returnPath ?? `/${role}`);
}

export async function logoutRoleAction(): Promise<void> {
  await clearRolePageAccess();
  redirect("/member");
}
