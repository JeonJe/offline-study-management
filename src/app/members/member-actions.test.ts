import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isAuthenticatedForUnitMock,
  getCurrentRolePageRoleMock,
  revalidateMemberDataMock,
  saveMemberPresetToDbMock,
} = vi.hoisted(() => ({
  isAuthenticatedForUnitMock: vi.fn(),
  getCurrentRolePageRoleMock: vi.fn(),
  revalidateMemberDataMock: vi.fn(),
  saveMemberPresetToDbMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticatedForUnit: isAuthenticatedForUnitMock,
}));

vi.mock("@/lib/role-session", () => ({
  getCurrentRolePageRole: getCurrentRolePageRoleMock,
}));

vi.mock("@/lib/cache-invalidation", () => ({
  revalidateMemberData: revalidateMemberDataMock,
}));

vi.mock("@/lib/member-store", () => ({
  SPECIAL_PARTICIPANT_ROLES: ["supporter", "buddy", "mentor", "manager"],
  saveMemberPresetToDb: saveMemberPresetToDbMock,
}));

import { saveMemberPresetAction } from "@/app/members/member-actions";

describe("saveMemberPresetAction", () => {
  beforeEach(() => {
    isAuthenticatedForUnitMock.mockReset();
    getCurrentRolePageRoleMock.mockReset();
    revalidateMemberDataMock.mockClear();
    saveMemberPresetToDbMock.mockReset();
  });

  it("인증되지 않은 사용자는 저장하지 않는다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(false);

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
      fixedAngels: ["오현직"],
      teamGroups: [{ teamName: "1팀", angels: ["오현직"], members: ["김루퍼"] }],
    });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(saveMemberPresetToDbMock).not.toHaveBeenCalled();
    expect(revalidateMemberDataMock).not.toHaveBeenCalled();
  });

  it("멤버 seq id를 보존해서 저장하고 관련 캐시를 무효화한다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    saveMemberPresetToDbMock.mockResolvedValue(undefined);

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
      fixedAngels: ["오현직"],
      teamGroups: [
        {
          teamName: "1팀",
          angels: ["오현직"],
          memberEntries: [
            { id: "member-a", name: "김루퍼", order: 0 },
            { id: "member-b", name: "김루퍼", order: 1 },
          ],
          members: ["김루퍼", "김루퍼"],
        },
      ],
      specialRoles: {
        mentor: ["alen"],
      },
    });

    expect(result).toEqual({ ok: true });
    expect(saveMemberPresetToDbMock).toHaveBeenCalledWith(
      "loop-pak-3",
      [
        {
          teamName: "1팀",
          angels: ["오현직"],
          members: ["김루퍼", "김루퍼"],
          memberEntries: [
            { id: "member-a", name: "김루퍼", order: 0 },
            { id: "member-b", name: "김루퍼", order: 1 },
          ],
        },
      ],
      ["오현직"],
      { mentor: ["alen"] }
    );
    expect(revalidateMemberDataMock).toHaveBeenCalledOnce();
  });

  it("필수 입력이 비어 있으면 저장하지 않는다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
      fixedAngels: [],
      teamGroups: [],
    });

    expect(result).toEqual({ ok: false, error: "invalid" });
    expect(saveMemberPresetToDbMock).not.toHaveBeenCalled();
  });

  it("admin role이 아니면 멤버 명단을 저장하지 않는다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("angel");

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
      fixedAngels: ["오현직"],
      teamGroups: [{ teamName: "1팀", angels: ["오현직"], members: ["김루퍼"] }],
    });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(saveMemberPresetToDbMock).not.toHaveBeenCalled();
  });
});
