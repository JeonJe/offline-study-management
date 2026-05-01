import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  isGlobalAuthenticated: isAuthenticatedMock,
}));

vi.mock("@/lib/role-session", () => ({
  getCurrentRolePageRole: getCurrentRolePageRoleMock,
  verifyRolePagePassword: verifyRolePagePasswordMock,
}));

import {
  createOperatingUnitAction,
  updateOperatingUnitAccessCodeAction,
  updateOperatingUnitAction,
} from "@/app/admin/operating-units/operating-unit-actions";
import {
  _resetSchemaStateForTesting,
  assertOperatingUnitAcceptsNewData,
  createOperatingUnitAccessToken,
  createOperatingUnit,
  getOperatingUnit,
  ensureOperatingUnitColumn,
  ensureOperatingUnitSchema,
  isProtectedOperatingUnitSlug,
  listOperatingUnits,
  normalizeOperatingUnitSlug,
  setOperatingUnitAccessCode,
  updateOperatingUnit,
  verifyOperatingUnitAccessCode,
  verifyOperatingUnitAccessToken,
} from "@/lib/operating-unit-store";

async function withSkipSchemaCheck(run: () => Promise<void>): Promise<void> {
  const prevSkipSchemaCheck = process.env.SKIP_SCHEMA_CHECK;
  process.env.SKIP_SCHEMA_CHECK = "1";
  try {
    await run();
  } finally {
    if (prevSkipSchemaCheck === undefined) {
      delete process.env.SKIP_SCHEMA_CHECK;
    } else {
      process.env.SKIP_SCHEMA_CHECK = prevSkipSchemaCheck;
    }
  }
}

describe("operating-unit-store", () => {
  const prevAppPassword = process.env.APP_PASSWORD;

  beforeEach(() => {
    process.env.APP_PASSWORD = "shared-entry-code";
    getCurrentRolePageRoleMock.mockReset();
    isAuthenticatedMock.mockReset();
    queryMock.mockReset();
    queryMock.mockResolvedValue([]);
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    verifyRolePagePasswordMock.mockReset();
    _resetSchemaStateForTesting();
  });

  afterEach(() => {
    if (prevAppPassword === undefined) {
      delete process.env.APP_PASSWORD;
    } else {
      process.env.APP_PASSWORD = prevAppPassword;
    }
  });

  it("normalizes labels into ascii-only stable slugs", () => {
    expect(normalizeOperatingUnitSlug(" 4기 루퍼스 ")).toBe("4");
    expect(normalizeOperatingUnitSlug("Career Framework")).toBe("career-framework");
    expect(normalizeOperatingUnitSlug("4기 루퍼스")).not.toContain("기");
  });

  it("keeps the current default operating unit stable even when URL-encoded", () => {
    expect(normalizeOperatingUnitSlug("3%EA%B8%B0")).toBe("loop-pak-3");
    expect(normalizeOperatingUnitSlug("3기")).toBe("loop-pak-3");
    expect(normalizeOperatingUnitSlug("loop-pak-3")).toBe("loop-pak-3");
  });

  it("protects legacy migration and current default operating unit slugs", () => {
    expect(isProtectedOperatingUnitSlug("default")).toBe(true);
    expect(isProtectedOperatingUnitSlug("3기")).toBe(true);
    expect(isProtectedOperatingUnitSlug("loop-pak-3")).toBe(true);
    expect(isProtectedOperatingUnitSlug("loop-pak-4")).toBe(false);
  });

  it("creates the default operating unit schema and default row", async () => {
    await ensureOperatingUnitSchema();

    const sql = queryMock.mock.calls.map(([text]) => String(text));
    expect(sql.some((text) => text.includes("create table if not exists public.operating_units"))).toBe(true);
    expect(sql.some((text) => text.includes("add column if not exists access_password_hash text"))).toBe(true);
    expect(sql.some((text) => text.includes("idx_operating_units_single_default"))).toBe(true);
    expect(sql.some((text) => text.includes("insert into public.operating_units"))).toBe(true);
  });

  it("adds a defaulted operating unit column without requiring callers to pass a unit", async () => {
    await ensureOperatingUnitColumn("meetings", "idx_meetings_operating_unit");

    const sql = queryMock.mock.calls.map(([text]) => String(text));
    expect(sql.some((text) => text.includes("add column if not exists operating_unit_slug text not null default 'loop-pak-3'"))).toBe(true);
    expect(sql.some((text) => text.includes("where operating_unit_slug is null"))).toBe(true);
    expect(sql.some((text) => text.includes("or operating_unit_slug = $3"))).toBe(true);
    expect(sql.some((text) => text.includes("idx_meetings_operating_unit"))).toBe(true);
  });

  it("rejects unsafe SQL identifiers for operating unit columns", async () => {
    await expect(
      ensureOperatingUnitColumn("meetings;drop table meetings", "idx_meetings_operating_unit")
    ).rejects.toThrow("Invalid SQL identifier");
  });

  it("listOperatingUnits를 호출하면 DB 쿼리가 실행된다", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([
        {
          slug: "loop-pak-3",
          name: "3기",
          description: null,
          isDefault: true,
          isActive: true,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ]);

      const units = await listOperatingUnits();

      expect(units).toHaveLength(1);
      expect(units[0].slug).toBe("loop-pak-3");
      expect(units[0].isDefault).toBe(true);
      const lastCall = queryMock.mock.calls.at(-1) as [string];
      expect(lastCall[0]).toContain("from public.operating_units");
      expect(lastCall[0]).toContain("where slug <> $1");
    });
  });

  it("listOperatingUnits가 빈 결과를 반환하면 빈 배열을 돌려준다", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([]);
      const units = await listOperatingUnits();
      expect(units).toEqual([]);
    });
  });

  it("listOperatingUnits 쿼리에 is_default desc 정렬이 포함된다", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([]);
      await listOperatingUnits();
      const lastCall = queryMock.mock.calls.at(-1) as [string];
      expect(lastCall[0]).toContain("order by is_default desc");
    });
  });

  it("creates a named operating unit without overwriting existing slugs", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([
        {
          slug: "4기",
          name: "4기",
          description: null,
          isDefault: false,
          isActive: true,
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
      expect(params[3]).toBeNull();
    });
  });

  it("can create a named operating unit with its own access code", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([
        {
          slug: "loop-pak-4",
          name: "4기",
          description: null,
          isDefault: false,
          isActive: true,
          hasAccessPassword: true,
          createdAt: "2026-04-27",
          updatedAt: "2026-04-27",
        },
      ]);

      await createOperatingUnit({
        slug: "loop-pak-4",
        name: "4기",
        accessPassword: "unit-secret",
      });

      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("access_password_hash");
      expect(params[3]).toBe(
        createHash("sha256")
          .update("saturday-meetup:operating-unit:loop-pak-4:unit-secret")
          .digest("hex")
      );
    });
  });

  it("createOperatingUnit rejects duplicate slugs instead of silently updating", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([]);

      await expect(
        createOperatingUnit({
          slug: "loop-pak-4",
          name: "4기",
        })
      ).rejects.toThrow("이미 존재하는 주소 식별자입니다.");
    });
  });

  it("gets one operating unit by normalized slug", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([
        {
          slug: "loop-pak-4",
          name: "4기",
          description: "신규 과정",
          isDefault: false,
          isActive: true,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);

      const unit = await getOperatingUnit(" Loop Pak 4 ");

      expect(unit?.slug).toBe("loop-pak-4");
      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("where slug = $1");
      expect(params).toEqual(["loop-pak-4"]);
    });
  });

  it("updates operating unit name and description without changing default status", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([
        {
          slug: "loop-pak-4",
          name: "4기",
          description: "수정됨",
          isDefault: false,
          isActive: true,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);

      await updateOperatingUnit({
        slug: "loop-pak-4",
        name: " 4기 ",
        description: " 수정됨 ",
      });

      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("update public.operating_units");
      expect(sql).not.toContain("set is_default");
      expect(sql).not.toContain("is_active =");
      expect(params).toEqual(["loop-pak-4", "4기", "수정됨"]);
    });
  });

  it("allows new data only for active operating units", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([
        {
          slug: "loop-pak-4",
          name: "4기",
          description: null,
          isDefault: false,
          isActive: true,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);

      await expect(assertOperatingUnitAcceptsNewData("loop-pak-4")).resolves.toBeUndefined();
    });
  });

  it("creates a unit access token from the stored hash without exposing plaintext", async () => {
    await withSkipSchemaCheck(async () => {
      const expectedToken = tokenFor("loop-pak-4", "unit-secret");
      queryMock.mockResolvedValueOnce([
        {
          accessPasswordHash: expectedToken,
          isActive: true,
        },
      ]);

      const token = await createOperatingUnitAccessToken("loop-pak-4", "unit-secret");

      expect(token).toBe(expectedToken);
      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("access_password_hash");
      expect(sql).not.toContain("unit-secret");
      expect(params).toEqual(["loop-pak-4"]);
    });
  });

  it("rejects a unit access token when the operating unit is inactive", async () => {
    await withSkipSchemaCheck(async () => {
      const token = tokenFor("loop-pak-4", "unit-secret");
      queryMock.mockResolvedValueOnce([
        {
          accessPasswordHash: token,
          isActive: false,
        },
      ]);

      await expect(verifyOperatingUnitAccessToken("loop-pak-4", token)).resolves.toBe(false);
    });
  });

  it("falls back to APP_PASSWORD while a unit-specific access code is not set", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([
        {
          accessPasswordHash: null,
          isActive: true,
        },
      ]);

      await expect(
        verifyOperatingUnitAccessCode("loop-pak-4", "shared-entry-code")
      ).resolves.toBe(true);
    });
  });

  it("stores a hashed unit access code", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([{ slug: "loop-pak-4" }]);

      await setOperatingUnitAccessCode({
        slug: "loop-pak-4",
        password: "new-unit-code",
      });

      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("set access_password_hash = $2");
      expect(params[0]).toBe("loop-pak-4");
      expect(params[1]).not.toBe("new-unit-code");
      expect(String(params[1])).toHaveLength(64);
    });
  });

  it("blocks new data for inactive operating units", async () => {
    await withSkipSchemaCheck(async () => {
      queryMock.mockResolvedValueOnce([
        {
          slug: "loop-pak-4",
          name: "4기",
          description: null,
          isDefault: false,
          isActive: false,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);

      await expect(assertOperatingUnitAcceptsNewData("loop-pak-4")).rejects.toThrow(
        "비활성 항목에는 새 데이터를 등록할 수 없습니다."
      );
    });
  });

  it("createOperatingUnitAction requires a unit access code before mutation", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    const formData = new FormData();
    formData.set("slug", "loop-pak-4");
    formData.set("name", "4기");

    await expect(createOperatingUnitAction(formData)).rejects.toThrow(
      "redirect:/admin/operating-units/new?unit=access-code-required"
    );
    expect(
      queryMock.mock.calls.some(([sql]) =>
        String(sql).includes("insert into public.operating_units")
      )
    ).toBe(false);
  });

  it("createOperatingUnitAction stores the unit access code when creating", async () => {
    await withSkipSchemaCheck(async () => {
      isAuthenticatedMock.mockResolvedValue(true);
      getCurrentRolePageRoleMock.mockResolvedValue("admin");
      queryMock.mockResolvedValueOnce([
        {
          slug: "loop-pak-4",
          name: "4기",
          description: null,
          isDefault: false,
          isActive: true,
          hasAccessPassword: true,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);
      const formData = new FormData();
      formData.set("slug", "loop-pak-4");
      formData.set("name", "4기");
      formData.set("accessPassword", "unit-secret");

      await expect(createOperatingUnitAction(formData)).rejects.toThrow(
        "redirect:/admin/operating-units/loop-pak-4/edit?unit=created"
      );

      const [, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(params[3]).toBe(
        createHash("sha256")
          .update("saturday-meetup:operating-unit:loop-pak-4:unit-secret")
          .digest("hex")
      );
    });
  });

  it("updateOperatingUnitAction mutates after global admin authentication", async () => {
    await withSkipSchemaCheck(async () => {
      isAuthenticatedMock.mockResolvedValue(true);
      getCurrentRolePageRoleMock.mockResolvedValue("admin");
      queryMock.mockResolvedValueOnce([
        {
          slug: "loop-pak-4",
          name: "4기",
          description: null,
          isDefault: false,
          isActive: true,
          createdAt: "2026-05-01",
          updatedAt: "2026-05-01",
        },
      ]);
      const formData = new FormData();
      formData.set("slug", "loop-pak-4");
      formData.set("name", "4기");

      await expect(updateOperatingUnitAction(formData)).rejects.toThrow(
        "redirect:/admin/operating-units/loop-pak-4/edit?unit=updated"
      );
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/operating-units");
    });
  });

  it("updateOperatingUnitAccessCodeAction stores a hashed access code after global admin authentication", async () => {
    await withSkipSchemaCheck(async () => {
      isAuthenticatedMock.mockResolvedValue(true);
      getCurrentRolePageRoleMock.mockResolvedValue("admin");
      queryMock.mockResolvedValueOnce([{ slug: "loop-pak-4" }]);

      const formData = new FormData();
      formData.set("slug", "loop-pak-4");
      formData.set("accessPassword", "new-unit-code");

      await expect(updateOperatingUnitAccessCodeAction(formData)).rejects.toThrow(
        "redirect:/admin/operating-units/loop-pak-4/edit?unit=access-code-updated"
      );

      const [sql, params] = queryMock.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("access_password_hash = $2");
      expect(params[0]).toBe("loop-pak-4");
      expect(params[1]).not.toBe("new-unit-code");
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/operating-units");
      expect(revalidatePathMock).toHaveBeenCalledWith(
        "/admin/operating-units/loop-pak-4/edit"
      );
    });
  });
});

function tokenFor(slug: string, password: string): string {
  return createHash("sha256")
    .update(`saturday-meetup:operating-unit:${slug}:${password}`)
    .digest("hex");
}
