import { describe, expect, it } from "vitest";
import { pickNearestUpcomingIsoDate, toKstIsoDate } from "@/lib/date-utils";

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

describe("pickNearestUpcomingIsoDate", () => {
  it("prefers the nearest date on or after today", () => {
    expect(
      pickNearestUpcomingIsoDate(
        ["2026-03-20", "2026-03-12", "2026-03-15", "2026-03-10"],
        "2026-03-12"
      )
    ).toBe("2026-03-12");
  });

  it("falls back to the most recent past date when no upcoming dates exist", () => {
    expect(
      pickNearestUpcomingIsoDate(
        ["2026-03-01", "2026-03-10", "2026-02-27"],
        "2026-03-12"
      )
    ).toBe("2026-03-10");
  });

  it("returns today when there are no scheduled dates", () => {
    expect(pickNearestUpcomingIsoDate([], "2026-03-12")).toBe("2026-03-12");
  });
});
