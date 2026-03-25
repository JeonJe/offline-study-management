import { describe, expect, it } from "vitest";

import { isMasterOverridePassword } from "@/lib/master-password";

describe("master password override", () => {
  it("accepts the Korean master password", () => {
    expect(isMasterOverridePassword("갈!")).toBe(true);
  });

  it("accepts the English keyboard variant", () => {
    expect(isMasterOverridePassword("rkf!")).toBe(true);
  });

  it("rejects other values", () => {
    expect(isMasterOverridePassword("RKF!")).toBe(false);
    expect(isMasterOverridePassword("wrong")).toBe(false);
  });
});
