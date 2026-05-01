import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookieDeleteMock,
  cookieGetMock,
  cookieSetMock,
  createOperatingUnitAccessTokenMock,
  normalizeOperatingUnitSlugMock,
  verifyOperatingUnitAccessTokenMock,
} = vi.hoisted(() => ({
  cookieDeleteMock: vi.fn(),
  cookieGetMock: vi.fn(),
  cookieSetMock: vi.fn(),
  createOperatingUnitAccessTokenMock: vi.fn(),
  normalizeOperatingUnitSlugMock: vi.fn((slug: string) => slug.trim()),
  verifyOperatingUnitAccessTokenMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: cookieGetMock,
    set: cookieSetMock,
    delete: cookieDeleteMock,
  })),
}));

vi.mock("@/lib/operating-unit-store", () => ({
  createOperatingUnitAccessToken: createOperatingUnitAccessTokenMock,
  normalizeOperatingUnitSlug: normalizeOperatingUnitSlugMock,
  verifyOperatingUnitAccessToken: verifyOperatingUnitAccessTokenMock,
}));

import {
  isAuthenticatedForUnit,
  isAuthenticated,
  isGlobalAuthenticated,
  login,
  logout,
} from "@/lib/auth";

describe("auth", () => {
  const prevAppPassword = process.env.APP_PASSWORD;

  beforeEach(() => {
    process.env.APP_PASSWORD = "global-admin-code";
    cookieDeleteMock.mockReset();
    cookieGetMock.mockReset();
    cookieSetMock.mockReset();
    createOperatingUnitAccessTokenMock.mockReset();
    normalizeOperatingUnitSlugMock.mockClear();
    verifyOperatingUnitAccessTokenMock.mockReset();
  });

  afterEach(() => {
    if (prevAppPassword === undefined) {
      delete process.env.APP_PASSWORD;
    } else {
      process.env.APP_PASSWORD = prevAppPassword;
    }
  });

  it("stores a scoped unit auth token when unit login succeeds", async () => {
    createOperatingUnitAccessTokenMock.mockResolvedValue("unit-token");

    await expect(
      login(" unit-code ", { unitSlug: " loop-pak-4 " })
    ).resolves.toBe(true);

    expect(createOperatingUnitAccessTokenMock).toHaveBeenCalledWith(
      "loop-pak-4",
      "unit-code"
    );
    expect(cookieSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "meetup_auth",
        value: "unit:loop-pak-4:unit-token",
        httpOnly: true,
        path: "/",
      })
    );
  });

  it("rejects unit login without setting a cookie when the code is invalid", async () => {
    createOperatingUnitAccessTokenMock.mockResolvedValue(null);

    await expect(
      login("wrong", { unitSlug: "loop-pak-4" })
    ).resolves.toBe(false);

    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("accepts a valid scoped unit auth cookie", async () => {
    cookieGetMock.mockReturnValue({ value: "unit:loop-pak-4:unit-token" });
    verifyOperatingUnitAccessTokenMock.mockResolvedValue(true);

    await expect(isAuthenticated()).resolves.toBe(true);

    expect(verifyOperatingUnitAccessTokenMock).toHaveBeenCalledWith(
      "loop-pak-4",
      "unit-token"
    );
  });

  it("accepts a scoped unit auth cookie only for its own unit", async () => {
    cookieGetMock.mockReturnValue({ value: "unit:loop-pak-4:unit-token" });
    verifyOperatingUnitAccessTokenMock.mockResolvedValue(true);

    await expect(isAuthenticatedForUnit("loop-pak-4")).resolves.toBe(true);
    await expect(isAuthenticatedForUnit("cohort-5")).resolves.toBe(false);

    expect(verifyOperatingUnitAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(verifyOperatingUnitAccessTokenMock).toHaveBeenCalledWith(
      "loop-pak-4",
      "unit-token"
    );
  });

  it("accepts a global admin auth cookie for any unit", async () => {
    cookieGetMock.mockReturnValue({ value: globalToken("global-admin-code") });

    await expect(isAuthenticatedForUnit("loop-pak-4")).resolves.toBe(true);

    expect(verifyOperatingUnitAccessTokenMock).not.toHaveBeenCalled();
  });

  it("does not accept a scoped unit auth cookie as global admin auth", async () => {
    cookieGetMock.mockReturnValue({ value: "unit:loop-pak-4:unit-token" });

    await expect(isGlobalAuthenticated()).resolves.toBe(false);

    expect(verifyOperatingUnitAccessTokenMock).not.toHaveBeenCalled();
  });

  it("keeps the existing global admin token compatible", async () => {
    cookieGetMock.mockReturnValue({ value: globalToken("global-admin-code") });

    await expect(isAuthenticated()).resolves.toBe(true);
    await expect(isGlobalAuthenticated()).resolves.toBe(true);

    expect(verifyOperatingUnitAccessTokenMock).not.toHaveBeenCalled();
  });

  it("clears the auth cookie on logout", async () => {
    await logout();

    expect(cookieDeleteMock).toHaveBeenCalledWith("meetup_auth");
  });
});

function globalToken(password: string): string {
  return createHash("sha256")
    .update(`saturday-meetup:${password}`)
    .digest("hex");
}
