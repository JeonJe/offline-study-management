import { describe, expect, it } from "vitest";
import { withSettlementInPath } from "@/lib/navigation-utils";

describe("withSettlementInPath", () => {
  it("builds fallback path when returnPath is null", () => {
    expect(withSettlementInPath(null, "after-1", "set-9", "2026-02-26")).toBe(
      "/afterparty/after-1?date=2026-02-26&settlement=set-9"
    );
  });

  it("preserves existing params and hash while replacing settlement", () => {
    const result = withSettlementInPath(
      "/afterparty/after-1?date=2026-02-26&team=2%ED%8C%80#participants",
      "after-1",
      "set-2"
    );
    expect(result).toBe("/afterparty/after-1?date=2026-02-26&team=2%ED%8C%80&settlement=set-2#participants");
  });

  it("appends settlement on root relative return paths", () => {
    expect(withSettlementInPath("/?date=2026-02-26", "after-1", "set-3")).toBe(
      "/?date=2026-02-26&settlement=set-3"
    );
  });
});
