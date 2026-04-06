import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

import {
  createMeeting,
  createRsvpsBulk,
  deleteMeeting,
  ensureSchema,
  updateMeeting,
} from "@/lib/meetup-store";

function hashMeetingPassword(password: string): string {
  return createHash("sha256")
    .update(`saturday-meetup:meeting:${password}`)
    .digest("hex");
}

describe("meetup-store meeting password flows", () => {
  beforeAll(async () => {
    queryMock.mockImplementation(async (text: string) => {
      if (text.includes("to_regclass('public.meetings')")) {
        return [{ meetings: "public.meetings", rsvps: "public.rsvps" }];
      }

      if (text.includes("from information_schema.columns")) {
        return [{ exists: true }];
      }

      return [];
    });

    await ensureSchema();
    queryMock.mockReset();
  });

  beforeEach(() => {
    queryMock.mockReset();
  });

  it("stores a hashed password when creating a protected meeting", async () => {
    queryMock.mockResolvedValueOnce([
      {
        id: "meeting-1",
        title: "토요 스터디",
        meetingDate: "2026-03-12",
        startTime: "14:00",
        location: "강남역",
        description: null,
        leaders: ["유진"],
        hasPassword: true,
        studentCount: 0,
        operationCount: 0,
        totalCount: 0,
      },
    ]);

    const created = await createMeeting({
      title: "토요 스터디",
      meetingDate: "2026-03-12",
      startTime: "14:00",
      location: "강남역",
      leaders: ["유진"],
      password: "room-secret",
    });

    expect(created.hasPassword).toBe(true);

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("password_hash");
    expect(params[6]).toEqual(["유진"]);
    expect(params[7]).toBe(hashMeetingPassword("room-secret"));
  });

  it("rejects metadata updates when a protected meeting password is missing", async () => {
    queryMock.mockResolvedValueOnce([
      {
        passwordHash: hashMeetingPassword("current-secret"),
      },
    ]);

    await expect(
      updateMeeting({
        id: "meeting-1",
        title: "토요 스터디",
        meetingDate: "2026-03-12",
        startTime: "14:00",
        location: "강남역",
      })
    ).rejects.toMatchObject({ code: "password-required" });

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("allows clearing meeting protection when the current password matches", async () => {
    queryMock
      .mockResolvedValueOnce([
        {
          passwordHash: hashMeetingPassword("current-secret"),
        },
      ])
      .mockResolvedValueOnce([]);

    await updateMeeting({
      id: "meeting-1",
      title: "토요 스터디",
      meetingDate: "2026-03-12",
      startTime: "14:00",
      location: "강남역",
      accessPassword: "current-secret",
      clearPassword: true,
    });

    const [sql, params] = queryMock.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("password_hash = $8");
    expect(params[7]).toBeNull();
  });

  it("allows meeting updates with the master password override", async () => {
    queryMock
      .mockResolvedValueOnce([
        {
          passwordHash: hashMeetingPassword("current-secret"),
        },
      ])
      .mockResolvedValueOnce([]);

    await updateMeeting({
      id: "meeting-1",
      title: "토요 스터디",
      meetingDate: "2026-03-12",
      startTime: "14:00",
      location: "강남역",
      accessPassword: "갈!",
    });

    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("rejects meeting deletion when the password does not match", async () => {
    queryMock.mockResolvedValueOnce([
      {
        passwordHash: hashMeetingPassword("room-secret"),
      },
    ]);

    await expect(deleteMeeting("meeting-1", "wrong-secret")).rejects.toMatchObject({
      code: "password-invalid",
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("allows meeting deletion with the master password override", async () => {
    queryMock
      .mockResolvedValueOnce([
        {
          passwordHash: hashMeetingPassword("room-secret"),
        },
      ])
      .mockResolvedValueOnce([]);

    await deleteMeeting("meeting-1", "갈!");

    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("promotes existing student rows to the selected role when adding participants in bulk", async () => {
    queryMock.mockResolvedValueOnce([{ changedCount: 1 }]);

    const changedCount = await createRsvpsBulk("meeting-1", "angel", ["이전제"], "11주차 오프라인");

    expect(changedCount).toBe(1);

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("update public.rsvps r");
    expect(sql).toContain("and r.role = 'student'");
    expect(sql).toContain("and i.role <> 'student'");
    expect(params[0]).toEqual(["이전제"]);
    expect(params[1]).toEqual(["angel"]);
  });
});
