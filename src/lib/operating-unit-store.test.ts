import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

import {
  _resetSchemaStateForTesting,
  createOperatingUnit,
  ensureOperatingUnitColumn,
  ensureOperatingUnitSchema,
  listOperatingUnits,
  normalizeOperatingUnitSlug,
} from "@/lib/operating-unit-store";

describe("operating-unit-store", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue([]);
    _resetSchemaStateForTesting();
  });

  it("normalizes labels into stable slugs", () => {
    expect(normalizeOperatingUnitSlug(" 4기 루퍼스 ")).toBe("4기-루퍼스");
    expect(normalizeOperatingUnitSlug("Career Framework")).toBe("career-framework");
  });

  it("creates the default operating unit schema and default row", async () => {
    await ensureOperatingUnitSchema();

    const sql = queryMock.mock.calls.map(([text]) => String(text));
    expect(sql.some((text) => text.includes("create table if not exists public.operating_units"))).toBe(true);
    expect(sql.some((text) => text.includes("idx_operating_units_single_default"))).toBe(true);
    expect(sql.some((text) => text.includes("insert into public.operating_units"))).toBe(true);
  });

  it("adds a defaulted operating unit column without requiring callers to pass a unit", async () => {
    await ensureOperatingUnitColumn("meetings", "idx_meetings_operating_unit");

    const sql = queryMock.mock.calls.map(([text]) => String(text));
    expect(sql.some((text) => text.includes("add column if not exists operating_unit_slug text not null default '3기'"))).toBe(true);
    expect(sql.some((text) => text.includes("where operating_unit_slug is null"))).toBe(true);
    expect(sql.some((text) => text.includes("idx_meetings_operating_unit"))).toBe(true);
  });

  it("rejects unsafe SQL identifiers for operating unit columns", async () => {
    await expect(
      ensureOperatingUnitColumn("meetings;drop table meetings", "idx_meetings_operating_unit")
    ).rejects.toThrow("Invalid SQL identifier");
  });

  it("listOperatingUnits를 호출하면 DB 쿼리가 실행된다", async () => {
    const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
    process.env.SKIP_SCHEMA_CHECK = "1";
    try {
      queryMock.mockResolvedValueOnce([
        {
          slug: "3기",
          name: "3기",
          description: null,
          isDefault: true,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ]);

      const units = await listOperatingUnits();

      expect(units).toHaveLength(1);
      expect(units[0].slug).toBe("3기");
      expect(units[0].isDefault).toBe(true);
      const lastCall = queryMock.mock.calls.at(-1) as [string];
      expect(lastCall[0]).toContain("from public.operating_units");
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });

  it("listOperatingUnits가 빈 결과를 반환하면 빈 배열을 돌려준다", async () => {
    const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
    process.env.SKIP_SCHEMA_CHECK = "1";
    try {
      queryMock.mockResolvedValueOnce([]);
      const units = await listOperatingUnits();
      expect(units).toEqual([]);
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });

  it("listOperatingUnits 쿼리에 is_default desc 정렬이 포함된다", async () => {
    const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
    process.env.SKIP_SCHEMA_CHECK = "1";
    try {
      queryMock.mockResolvedValueOnce([]);
      await listOperatingUnits();
      const lastCall = queryMock.mock.calls.at(-1) as [string];
      expect(lastCall[0]).toContain("order by is_default desc");
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });

  it("upserts a named operating unit", async () => {
    const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
    process.env.SKIP_SCHEMA_CHECK = "1";
    try {
      queryMock.mockResolvedValueOnce([
        {
          slug: "4기",
          name: "4기",
          description: null,
          isDefault: false,
          createdAt: "2026-04-27",
          updatedAt: "2026-04-27",
        },
      ]);

      const created = await createOperatingUnit({
        slug: " 4기 ",
        name: "4기",
      });

      expect(created.slug).toBe("4기");
      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("on conflict (slug)");
      expect(params[0]).toBe("4기");
      expect(params[1]).toBe("4기");
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });
});
