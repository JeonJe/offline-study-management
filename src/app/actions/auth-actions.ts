"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import {
  cohortEntryPath,
  dashboardPath,
  safeReturnPath,
  textFrom,
} from "@/app/actions/shared-action-utils";

export async function loginAction(formData: FormData): Promise<void> {
  const password = textFrom(formData, "password").trim();
  const selectedUnit = textFrom(formData, "selectedUnit").trim();
  const authScope = textFrom(formData, "authScope").trim();
  const returnPath = safeReturnPath(formData);
  const success = await login(
    password,
    authScope === "unit" ? { unitSlug: selectedUnit } : undefined
  );
  const loginParams = new URLSearchParams();
  if (selectedUnit) loginParams.set("unit", selectedUnit);

  if (!success) {
    if (authScope === "admin") {
      loginParams.set("adminAuth", "invalid");
    } else {
      loginParams.set("auth", "invalid");
    }
    redirect(`/?${loginParams.toString()}`);
  }

  redirect(returnPath ?? (authScope === "unit" ? cohortEntryPath(selectedUnit) : dashboardPath()));
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/");
}
