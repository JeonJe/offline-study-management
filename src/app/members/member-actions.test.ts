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
      fixedAngels: ["이순신"],
      teamGroups: [{ teamName: "1팀", angels: ["이순신"], members: ["세종대왕"] }],
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
      fixedAngels: ["이순신"],
      teamGroups: [
        {
          teamName: "1팀",
          angels: ["이순신"],
          memberEntries: [
            { id: "member-a", name: "세종대왕", order: 0 },
            { id: "member-b", name: "세종대왕", order: 1 },
          ],
          members: ["세종대왕", "세종대왕"],
        },
      ],
      specialRoles: {
        mentor: ["장영실"],
      },
    });

    expect(result).toEqual({ ok: true });
    expect(saveMemberPresetToDbMock).toHaveBeenCalledWith(
      "loop-pak-3",
      [
        {
          teamName: "1팀",
          angels: ["이순신"],
          members: ["세종대왕", "세종대왕"],
          memberEntries: [
            { id: "member-a", name: "세종대왕", order: 0 },
            { id: "member-b", name: "세종대왕", order: 1 },
          ],
        },
      ],
      ["이순신"],
      { mentor: ["장영실"] }
    );
    expect(revalidateMemberDataMock).toHaveBeenCalledOnce();
  });

  it("팀이 없어도 운영진 역할 명단을 저장한다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    saveMemberPresetToDbMock.mockResolvedValue(undefined);

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
      fixedAngels: ["유관순"],
      teamGroups: [],
      specialRoles: {
        mentor: ["장영실"],
        manager: ["허준"],
        supporter: ["정약용"],
        buddy: ["신사임당"],
      },
    });

    expect(result).toEqual({ ok: true });
    expect(saveMemberPresetToDbMock).toHaveBeenCalledWith(
      "loop-pak-3",
      [],
      ["유관순"],
      {
        mentor: ["장영실"],
        manager: ["허준"],
        supporter: ["정약용"],
        buddy: ["신사임당"],
      }
    );
    expect(revalidateMemberDataMock).toHaveBeenCalledOnce();
  });

  it("팀 담당 엔젤은 fixedAngels가 비어 있어도 엔젤 명단에 포함해 저장한다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    saveMemberPresetToDbMock.mockResolvedValue(undefined);

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
      fixedAngels: [],
      teamGroups: [
        {
          teamName: "1팀",
          angels: ["이순신"],
          members: ["세종대왕"],
          memberEntries: [{ id: "member-a", name: "세종대왕", order: 0 }],
        },
      ],
      specialRoles: {},
    });

    expect(result).toEqual({ ok: true });
    expect(saveMemberPresetToDbMock).toHaveBeenCalledWith(
      "loop-pak-3",
      [
        {
          teamName: "1팀",
          angels: ["이순신"],
          members: ["세종대왕"],
          memberEntries: [{ id: "member-a", name: "세종대왕", order: 0 }],
        },
      ],
      ["이순신"],
      {}
    );
  });

  it("빈 배열 명단은 전체 명단 삭제로 저장한다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    saveMemberPresetToDbMock.mockResolvedValue(undefined);

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
      fixedAngels: [],
      teamGroups: [],
      specialRoles: {},
    });

    expect(result).toEqual({ ok: true });
    expect(saveMemberPresetToDbMock).toHaveBeenCalledWith(
      "loop-pak-3",
      [],
      [],
      {}
    );
  });

  it("명단 필드가 없는 호출은 저장하지 않는다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
    });

    expect(result).toEqual({ ok: false, error: "invalid" });
    expect(saveMemberPresetToDbMock).not.toHaveBeenCalled();
  });

  it("admin role이 아니면 멤버 명단을 저장하지 않는다", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("angel");

    const result = await saveMemberPresetAction({
      operatingUnitSlug: "loop-pak-3",
      fixedAngels: ["이순신"],
      teamGroups: [{ teamName: "1팀", angels: ["이순신"], members: ["세종대왕"] }],
    });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(saveMemberPresetToDbMock).not.toHaveBeenCalled();
  });
});
