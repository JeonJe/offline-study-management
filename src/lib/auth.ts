import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  createOperatingUnitAccessToken,
  normalizeOperatingUnitSlug,
  verifyOperatingUnitAccessToken,
} from "@/lib/operating-unit-store";

const AUTH_COOKIE_NAME = "meetup_auth";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const UNIT_AUTH_TOKEN_PREFIX = "unit";

function requireAppPassword(): string {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    throw new Error(
      "APP_PASSWORD is missing. Set it in .env.local or Vercel Environment Variables."
    );
  }
  return appPassword;
}

function makeAuthToken(password: string): string {
  return createHash("sha256")
    .update(`saturday-meetup:${password}`)
    .digest("hex");
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!currentToken) return false;

  if (isGlobalAuthToken(currentToken)) {
    return true;
  }

  const unitToken = parseUnitAuthToken(currentToken);
  if (!unitToken) {
    return false;
  }
  return verifyOperatingUnitAccessToken(unitToken.slug, unitToken.token);
}

export async function isGlobalAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return Boolean(currentToken && isGlobalAuthToken(currentToken));
}

export async function login(
  password: string,
  options: { unitSlug?: string } = {}
): Promise<boolean> {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) return false;

  const unitSlug = normalizeOperatingUnitSlug(options.unitSlug ?? "");
  if (unitSlug) {
    const unitToken = await createOperatingUnitAccessToken(
      unitSlug,
      normalizedPassword
    );
    if (!unitToken) {
      return false;
    }

    const cookieStore = await cookies();
    cookieStore.set({
      name: AUTH_COOKIE_NAME,
      value: formatUnitAuthToken(unitSlug, unitToken),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: "/",
    });
    return true;
  }

  const expectedToken = makeAuthToken(requireAppPassword());
  const inputToken = makeAuthToken(normalizedPassword);
  if (!safeEquals(inputToken, expectedToken)) return false;

  const cookieStore = await cookies();
  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: expectedToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });
  return true;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

function formatUnitAuthToken(slug: string, token: string): string {
  return `${UNIT_AUTH_TOKEN_PREFIX}:${encodeURIComponent(slug)}:${token}`;
}

function parseUnitAuthToken(
  cookieValue: string
): { slug: string; token: string } | null {
  const [prefix, encodedSlug, token] = cookieValue.split(":");
  if (prefix !== UNIT_AUTH_TOKEN_PREFIX || !encodedSlug || !token) {
    return null;
  }

  try {
    return { slug: decodeURIComponent(encodedSlug), token };
  } catch {
    return null;
  }
}

function isGlobalAuthToken(token: string): boolean {
  return safeEquals(token, makeAuthToken(requireAppPassword()));
}
