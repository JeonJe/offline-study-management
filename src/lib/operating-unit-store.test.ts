import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentRolePageRoleMock,
  isAuthenticatedMock,
  queryMock,
  redirectMock,
  revalidatePathMock,
  verifyRolePagePasswordMock,
} = vi.hoisted(() => ({
  getCurrentRolePageRoleMock: vi.fn(),
  isAuthenticatedMock: vi.fn(),
  queryMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  verifyRolePagePasswordMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

vi.mock("@/lib/role-session", () => ({
  getCurrentRolePageRole: getCurrentRolePageRoleMock,
  verifyRolePagePassword: verifyRolePagePasswordMock,
}));

import {
  createOperatingUnitAction,
  updateOperatingUnitAction,
} from "@/app/admin/operating-units/operating-unit-actions";
import {
  _resetSchemaStateForTesting,
  createOperatingUnit,
  getOperatingUnit,
  ensureOperatingUnitColumn,
  ensureOperatingUnitSchema,
  listOperatingUnits,
  normalizeOperatingUnitSlug,
  updateOperatingUnit,
} from "@/lib/operating-unit-store";

describe("operating-unit-store", () => {
  beforeEach(() => {
    getCurrentRolePageRoleMock.mockReset();
    isAuthenticatedMock.mockReset();
    queryMock.mockReset();
    queryMock.mockResolvedValue([]);
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    verifyRolePagePasswordMock.mockReset();
    _resetSchemaStateForTesting();
  });

  it("normalizes labels into ascii-only stable slugs", () => {
    expect(normalizeOperatingUnitSlug(" 4기 루퍼스 ")).toBe("4");
    expect(normalizeOperatingUnitSlug("Career Framework")).toBe("career-framework");
    expect(normalizeOperatingUnitSlug("4기 루퍼스")).not.toContain("기");
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

  it("creates a named operating unit without overwriting existing slugs", async () => {
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
      expect(sql).toContain("do nothing");
      expect(sql).not.toContain("do update");
      expect(params[0]).toBe("4");
      expect(params[1]).toBe("4기");
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });

  it("createOperatingUnit rejects duplicate slugs instead of silently updating", async () => {
    const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
    process.env.SKIP_SCHEMA_CHECK = "1";
    try {
      queryMock.mockResolvedValueOnce([]);

      await expect(
        createOperatingUnit({
          slug: "cohort-4",
          name: "4기",
        })
      ).rejects.toThrow("이미 존재하는 운영 단위 식별자입니다.");
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });

  it("gets one operating unit by normalized slug", async () => {
    const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
    process.env.SKIP_SCHEMA_CHECK = "1";
    try {
      queryMock.mockResolvedValueOnce([
        {
          slug: "cohort-4",
          name: "4기",
          description: "신규 기수",
          isDefault: false,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);

      const unit = await getOperatingUnit(" Cohort 4 ");

      expect(unit?.slug).toBe("cohort-4");
      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("where slug = $1");
      expect(params).toEqual(["cohort-4"]);
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });

  it("updates operating unit name and description without changing default status", async () => {
    const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
    process.env.SKIP_SCHEMA_CHECK = "1";
    try {
      queryMock.mockResolvedValueOnce([
        {
          slug: "cohort-4",
          name: "4기",
          description: "수정됨",
          isDefault: false,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);

      await updateOperatingUnit({
        slug: "cohort-4",
        name: " 4기 ",
        description: " 수정됨 ",
      });

      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("update public.operating_units");
      expect(sql).not.toContain("set is_default");
      expect(params).toEqual(["cohort-4", "4기", "수정됨"]);
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });

  it("createOperatingUnitAction requires the admin role password before mutation", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    verifyRolePagePasswordMock.mockReturnValue(false);
    const formData = new FormData();
    formData.set("slug", "cohort-4");
    formData.set("name", "4기");
    formData.set("adminPassword", "wrong");

    await expect(createOperatingUnitAction(formData)).rejects.toThrow(
      "redirect:/admin/operating-units?unit=password-invalid"
    );
    expect(
      queryMock.mock.calls.some(([sql]) =>
        String(sql).includes("insert into public.operating_units")
      )
    ).toBe(false);
  });

  it("updateOperatingUnitAction mutates when admin role password is valid", async () => {
    const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
    process.env.SKIP_SCHEMA_CHECK = "1";
    try {
      isAuthenticatedMock.mockResolvedValue(true);
      getCurrentRolePageRoleMock.mockResolvedValue("admin");
      verifyRolePagePasswordMock.mockReturnValue(true);
      queryMock.mockResolvedValueOnce([
        {
          slug: "cohort-4",
          name: "4기",
          description: null,
          isDefault: false,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);
      const formData = new FormData();
      formData.set("slug", "cohort-4");
      formData.set("name", "4기");
      formData.set("adminPassword", "admin-secret");

      await expect(updateOperatingUnitAction(formData)).rejects.toThrow(
        "redirect:/admin/operating-units/cohort-4/edit?unit=updated"
      );
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/operating-units");
    } finally {
      if (prevSkipSchemaCheck === undefined) {
        delete process.env.SKIP_SCHEMA_CHECK;
      } else {
        process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
      }
    }
  });
});
