import { describe, expect, it } from "vitest";
import { toKstIsoDate } from "@/lib/date-utils";

describe("toKstIsoDate", () => {
  it("returns same calendar day for midday UTC", () => {
    const input = new Date("2026-02-26T12:00:00.000Z");
    expect(toKstIsoDate(input)).toBe("2026-02-26");
  });

  it("rolls forward to next day near UTC midnight", () => {
    const input = new Date("2026-02-26T18:30:00.000Z");
    expect(toKstIsoDate(input)).toBe("2026-02-27");
  });

  it("keeps previous day when UTC is still before KST midnight", () => {
    const input = new Date("2026-02-26T00:10:00.000Z");
    expect(toKstIsoDate(input)).toBe("2026-02-26");
  });
});
