import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, withTransactionMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  withTransactionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
}));

import {
  createAfterpartyParticipantsBulk,
  deleteAfterpartySettlement,
  ensureAfterpartySchema,
  updateAfterpartyParticipantSettlement,
} from "@/lib/afterparty-store";

describe("afterparty-store settlement flows", () => {
  beforeAll(async () => {
    queryMock.mockResolvedValue([]);
    await ensureAfterpartySchema();
    queryMock.mockClear();
  });

  beforeEach(() => {
    queryMock.mockClear();
    withTransactionMock.mockReset();
  });

  it("creates participants once and counts only newly linked settlement participants", async () => {
    const txCalls: Array<{ text: string; params?: unknown[] }> = [];

    withTransactionMock.mockImplementation(async (callback: (tq: (text: string, params?: unknown[]) => Promise<unknown[]>) => Promise<number>) => {
      const tq = async (text: string, params?: unknown[]): Promise<unknown[]> => {
        txCalls.push({ text, params });

        if (
          text.includes("from public.afterparty_settlements") &&
          text.includes("where id = $1") &&
          text.includes("afterparty_id = $2")
        ) {
          return [{ id: "settle-1" }];
        }

        if (
          text.includes("select count(*)::int as \"insertedCount\"") &&
          text.includes("from inserted_links")
        ) {
          return [{ insertedCount: 1 }];
        }

        return [];
      };

      return callback(tq);
    });

    const inserted = await createAfterpartyParticipantsBulk(
      "afterparty-1",
      ["Alice", "Bob", "Alice"],
      "settle-1"
    );

    expect(inserted).toBe(1);
    expect(withTransactionMock).toHaveBeenCalledTimes(1);

    const participantInsertCalls = txCalls.filter((call) =>
      call.text.includes("insert into public.afterparty_participants")
    );
    expect(participantInsertCalls).toHaveLength(1);
    const [firstInsertCall] = participantInsertCalls;
    expect(firstInsertCall?.params?.[0]).toEqual(["Alice", "Bob"]);
  });

  it("stores participant role when explicit role input is provided", async () => {
    const participantInsertParams: unknown[][] = [];

    withTransactionMock.mockImplementation(async (callback: (tq: (text: string, params?: unknown[]) => Promise<unknown[]>) => Promise<number>) => {
      const tq = async (text: string, params?: unknown[]): Promise<unknown[]> => {
        if (
          text.includes("from public.afterparty_settlements") &&
          text.includes("where id = $1") &&
          text.includes("afterparty_id = $2")
        ) {
          return [{ id: "settle-1" }];
        }

        if (text.includes("insert into public.afterparty_participants")) {
          participantInsertParams.push(params ?? []);
        }

        if (
          text.includes("select count(*)::int as \"insertedCount\"") &&
          text.includes("from inserted_links")
        ) {
          return [{ insertedCount: 1 }];
        }

        return [];
      };

      return callback(tq);
    });

    const inserted = await createAfterpartyParticipantsBulk(
      "afterparty-1",
      [{ name: "annie", role: "manager" }],
      "settle-1"
    );

    expect(inserted).toBe(1);
    expect(participantInsertParams).toHaveLength(1);
    expect(participantInsertParams[0]?.[0]).toEqual(["annie"]);
    expect(participantInsertParams[0]?.[1]).toEqual(["manager"]);
  });

  it("rejects settlement deletion when only one settlement remains", async () => {
    withTransactionMock.mockImplementation(async (callback: (tq: (text: string, params?: unknown[]) => Promise<unknown[]>) => Promise<string>) => {
      const tq = async (text: string): Promise<unknown[]> => {
        if (text.includes("select count(*)::int as count")) {
          return [{ count: 1 }];
        }
        return [];
      };
      return callback(tq);
    });

    await expect(deleteAfterpartySettlement("settle-1", "afterparty-1")).rejects.toThrow(
      "최소 1개의 정산이 필요합니다."
    );
  });

  it("updates only requested settlement when settlementId is provided", async () => {
    queryMock.mockResolvedValue([]);

    await updateAfterpartyParticipantSettlement("participant-1", "afterparty-1", "settle-1", true);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("sp.settlement_id = $2");
    expect(params).toEqual(["participant-1", "settle-1", "afterparty-1", true]);
  });

  it("updates all settlements in afterparty when settlementId is omitted", async () => {
    queryMock.mockResolvedValue([]);

    await updateAfterpartyParticipantSettlement("participant-1", "afterparty-1", undefined, false);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("s.afterparty_id = $2");
    expect(params).toEqual(["participant-1", "afterparty-1", false]);
  });
});
