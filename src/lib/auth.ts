import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "meetup_auth";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

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

  const expectedToken = makeAuthToken(requireAppPassword());
  return safeEquals(currentToken, expectedToken);
}

export async function login(password: string): Promise<boolean> {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) return false;

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
