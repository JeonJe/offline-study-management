import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  type ConfiguredRolePages,
  type RolePageRole,
  normalizeRolePageRole,
} from "@/lib/role-page";

const ROLE_COOKIE_NAME = "meetup_role_access";
const ROLE_COOKIE_MAX_AGE = 60 * 60 * 12;

function rolePassword(role: RolePageRole): string | null {
  if (role === "angel") {
    return process.env.ANGEL_PAGE_PASSWORD?.trim() || null;
  }

  if (role === "admin") {
    return process.env.ADMIN_PAGE_PASSWORD?.trim() || null;
  }

  return null;
}

function makeRoleToken(role: RolePageRole, password: string): string {
  return createHash("sha256")
    .update(`saturday-meetup:${role}:${password}`)
    .digest("hex");
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getConfiguredRolePages(): ConfiguredRolePages {
  return {
    angel: Boolean(rolePassword("angel")),
    admin: Boolean(rolePassword("admin")),
  };
}

export function verifyRolePagePassword(role: RolePageRole, password: string): boolean {
  const expectedPassword = rolePassword(role);
  if (!expectedPassword) return false;

  const normalizedPassword = password.trim();
  if (!normalizedPassword) return false;

  return safeEquals(
    makeRoleToken(role, normalizedPassword),
    makeRoleToken(role, expectedPassword)
  );
}

export async function getCurrentRolePageRole(): Promise<RolePageRole | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ROLE_COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  const [roleText, token] = cookieValue.split(".");
  const role = normalizeRolePageRole(roleText);
  const password = role ? rolePassword(role) : null;

  if (!role || !password || !token) return null;

  return safeEquals(token, makeRoleToken(role, password)) ? role : null;
}

export async function grantRolePageAccess(
  role: RolePageRole,
  password: string
): Promise<boolean> {
  if (!verifyRolePagePassword(role, password)) {
    return false;
  }

  const expectedPassword = rolePassword(role);
  if (!expectedPassword) return false;

  const cookieStore = await cookies();
  cookieStore.set({
    name: ROLE_COOKIE_NAME,
    value: `${role}.${makeRoleToken(role, expectedPassword)}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ROLE_COOKIE_MAX_AGE,
    path: "/",
  });
  return true;
}

export async function clearRolePageAccess(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ROLE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}
