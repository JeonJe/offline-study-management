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
  MAX_MEETING_CAPACITY,
  parseCapacityInput,
  promoteWaitlistedRsvp,
  updateMeeting,
} from "@/lib/meetup-store";

function hashMeetingPassword(password: string): string {
  return createHash("sha256")
    .update(`saturday-meetup:meeting:${password}`)
    .digest("hex");
}

function activeOperatingUnit(slug = "loop-pak-3") {
  return [{
    slug,
    name: slug,
    description: null,
    isDefault: slug === "loop-pak-3",
    isActive: true,
    createdAt: "2026-05-01",
    updatedAt: "2026-05-01",
  }];
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
    queryMock
      .mockResolvedValueOnce(activeOperatingUnit())
      .mockResolvedValueOnce([
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

    const [sql, params] = queryMock.mock.calls[1] as [string, unknown[]];
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
        capacity: null,
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
      capacity: null,
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
      capacity: null,
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

  it("locks the meeting and assigns waitlist status from confirmed capacity", async () => {
    queryMock.mockResolvedValueOnce([{ changedCount: 2 }]);

    await createRsvpsBulk("meeting-1", "student", ["민수", "지수"], "정원 테스트");

    const [sql] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("for update");
    expect(sql).toContain("where r.status = 'confirmed'");
    expect(sql).toContain("with ordinality");
    expect(sql).not.toContain("row_number() over ()");
    expect(sql).toContain("insert into public.rsvps (id, meeting_id, name, role, status, note)");
    expect(sql).toContain("when ml.capacity is null then 'confirmed'");
    expect(sql).toContain("else 'waitlist'");
  });

  it("promotes a waitlisted RSVP only when confirmed capacity remains", async () => {
    queryMock.mockResolvedValueOnce([{ promoted: true }]);

    await expect(promoteWaitlistedRsvp("meeting-1", "rsvp-1")).resolves.toBe(true);

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("for update");
    expect(sql).toContain("where r.status = 'confirmed'");
    expect(sql).toContain("r.status = 'waitlist'");
    expect(sql).toContain("cc.count < ml.capacity");
    expect(sql).toContain("set status = 'confirmed'");
    expect(params).toEqual(["meeting-1", "rsvp-1"]);
  });
});

describe("meetup-store capacity flows", () => {
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

  it("stores capacity when creating a meeting with a capacity limit", async () => {
    queryMock
      .mockResolvedValueOnce(activeOperatingUnit())
      .mockResolvedValueOnce([
        {
          id: "meeting-cap",
          title: "정원 있는 모임",
          meetingDate: "2026-04-05",
          startTime: "14:00",
          location: "홍대",
          description: null,
          leaders: [],
          hasPassword: false,
          capacity: 30,
          studentCount: 0,
          operationCount: 0,
          totalCount: 0,
        },
      ]);

    const created = await createMeeting({
      title: "정원 있는 모임",
      meetingDate: "2026-04-05",
      startTime: "14:00",
      location: "홍대",
      capacity: 30,
    });

    expect(created.capacity).toBe(30);

    const [sql, params] = queryMock.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("capacity");
    expect(params[8]).toBe(30);
  });

  it("stores capacity of 0 as a valid boundary value", async () => {
    queryMock
      .mockResolvedValueOnce(activeOperatingUnit())
      .mockResolvedValueOnce([
        {
          id: "meeting-zero",
          operatingUnitSlug: "default",
          title: "정원 마감 모임",
          meetingDate: "2026-04-05",
          startTime: "14:00",
          location: "홍대",
          description: "",
          leaders: [],
          hasPassword: false,
          capacity: 0,
          studentCount: 0,
          operationCount: 0,
          totalCount: 0,
        },
      ]);

    const created = await createMeeting({
      title: "정원 마감 모임",
      meetingDate: "2026-04-05",
      startTime: "14:00",
      location: "홍대",
      capacity: 0,
    });

    expect(created.capacity).toBe(0);
    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    expect(params[8]).toBe(0);
  });

  it("stores null capacity when creating a meeting without capacity", async () => {
    queryMock
      .mockResolvedValueOnce(activeOperatingUnit())
      .mockResolvedValueOnce([
        {
          id: "meeting-nocap",
          title: "정원 없는 모임",
          meetingDate: "2026-04-05",
          startTime: "14:00",
          location: "홍대",
          description: null,
          leaders: [],
          hasPassword: false,
          capacity: null,
          studentCount: 0,
          operationCount: 0,
          totalCount: 0,
        },
      ]);

    const created = await createMeeting({
      title: "정원 없는 모임",
      meetingDate: "2026-04-05",
      startTime: "14:00",
      location: "홍대",
    });

    expect(created.capacity).toBeNull();

    const [sql, params] = queryMock.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("capacity");
    expect(params[8]).toBeNull();
  });

  it("updates capacity to a positive number", async () => {
    queryMock
      .mockResolvedValueOnce([{ passwordHash: null }])
      .mockResolvedValueOnce([]);

    await updateMeeting({
      id: "meeting-1",
      title: "토요 스터디",
      meetingDate: "2026-03-12",
      startTime: "14:00",
      location: "강남역",
      capacity: 50,
    });

    const [sql, params] = queryMock.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("capacity = $9");
    expect(params[8]).toBe(50);
  });

  it("clears capacity by setting it to null", async () => {
    queryMock
      .mockResolvedValueOnce([{ passwordHash: null }])
      .mockResolvedValueOnce([]);

    await updateMeeting({
      id: "meeting-1",
      title: "토요 스터디",
      meetingDate: "2026-03-12",
      startTime: "14:00",
      location: "강남역",
      capacity: null,
    });

    const [sql, params] = queryMock.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("capacity = $9");
    expect(params[8]).toBeNull();
  });

  it("preserves capacity when updating with the same value", async () => {
    queryMock
      .mockResolvedValueOnce([{ passwordHash: null }])
      .mockResolvedValueOnce([]);

    await updateMeeting({
      id: "meeting-1",
      title: "토요 스터디",
      meetingDate: "2026-03-12",
      startTime: "14:00",
      location: "강남역",
      capacity: 30,
    });

    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    expect(params[8]).toBe(30);
  });
});

describe("parseCapacityInput", () => {
  it("빈 문자열은 empty를 반환한다 (정원 미설정)", () => {
    expect(parseCapacityInput("")).toEqual({ kind: "empty" });
  });

  it("공백만 있는 문자열은 empty를 반환한다", () => {
    expect(parseCapacityInput("   ")).toEqual({ kind: "empty" });
  });

  it("0은 value 0으로 파싱된다 (정원 마감 의도)", () => {
    expect(parseCapacityInput("0")).toEqual({ kind: "value", value: 0 });
  });

  it("양의 정수는 value로 파싱된다", () => {
    expect(parseCapacityInput("30")).toEqual({ kind: "value", value: 30 });
  });

  it("앞뒤 공백이 있는 정수도 정상 파싱된다", () => {
    expect(parseCapacityInput(" 30 ")).toEqual({ kind: "value", value: 30 });
  });

  it("MAX_MEETING_CAPACITY 경계값은 허용된다", () => {
    expect(parseCapacityInput(String(MAX_MEETING_CAPACITY))).toEqual({
      kind: "value",
      value: MAX_MEETING_CAPACITY,
    });
  });

  it("MAX_MEETING_CAPACITY + 1은 invalid", () => {
    expect(parseCapacityInput(String(MAX_MEETING_CAPACITY + 1))).toEqual({
      kind: "invalid",
    });
  });

  it("음수는 invalid", () => {
    expect(parseCapacityInput("-1")).toEqual({ kind: "invalid" });
  });

  it("소수는 invalid", () => {
    expect(parseCapacityInput("3.14")).toEqual({ kind: "invalid" });
  });

  it("숫자가 아닌 문자열은 invalid", () => {
    expect(parseCapacityInput("abc")).toEqual({ kind: "invalid" });
    expect(parseCapacityInput("10명")).toEqual({ kind: "invalid" });
  });

  it("Infinity / NaN 표현은 invalid", () => {
    expect(parseCapacityInput("Infinity")).toEqual({ kind: "invalid" });
    expect(parseCapacityInput("NaN")).toEqual({ kind: "invalid" });
  });
});
