import { describe, expect, it } from "vitest";

import {
  canOpenRolePage,
  getRolePage,
  listRolePages,
  normalizeRolePageRole,
} from "@/lib/role-page";

describe("role pages", () => {
  it("normalizes supported roles", () => {
    expect(normalizeRolePageRole("member")).toBe("member");
    expect(normalizeRolePageRole("angel")).toBe("angel");
    expect(normalizeRolePageRole("admin")).toBe("admin");
    expect(normalizeRolePageRole("supporter")).toBeNull();
  });

  it("uses direct role page paths", () => {
    expect(listRolePages().map((page) => page.path)).toEqual([
      "/member",
      "/angel",
      "/admin",
    ]);
    expect(getRolePage("angel").label).toBe("엔젤");
  });

  it("allows authenticated users to open the member page", () => {
    expect(canOpenRolePage("member", null, { angel: false, admin: false })).toBe("allowed");
  });

  it("blocks angel and admin pages without the matching role", () => {
    expect(canOpenRolePage("angel", null, { angel: true, admin: true })).toBe("role-required");
    expect(canOpenRolePage("admin", "angel", { angel: true, admin: true })).toBe("role-required");
  });

  it("lets higher roles open lower role pages", () => {
    expect(canOpenRolePage("angel", "admin", { angel: true, admin: true })).toBe("allowed");
  });

  it("shows setup state when a protected role password is missing", () => {
    expect(canOpenRolePage("angel", null, { angel: false, admin: true })).toBe("role-not-configured");
  });
});
