import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateTagMock } = vi.hoisted(() => ({
  updateTagMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  updateTag: updateTagMock,
}));

import {
  revalidateAfterpartyData,
  revalidateMeetupData,
  revalidateMemberData,
} from "@/lib/cache-invalidation";

describe("cache invalidation", () => {
  beforeEach(() => {
    updateTagMock.mockClear();
  });

  it("모임 생성/수정/삭제/참여자 변경은 모임 캐시와 참여 통계 캐시를 함께 무효화한다", () => {
    revalidateMeetupData();

    expect(updateTagMock).toHaveBeenCalledWith("meetup-data");
    expect(updateTagMock).toHaveBeenCalledWith("attendance");
  });

  it("뒷풀이 생성/수정/삭제/참여자 변경은 뒷풀이 캐시와 참여 통계 캐시를 함께 무효화한다", () => {
    revalidateAfterpartyData();

    expect(updateTagMock).toHaveBeenCalledWith("afterparty-data");
    expect(updateTagMock).toHaveBeenCalledWith("attendance");
  });

  it("멤버/팀 저장은 멤버 캐시와 참여 통계 캐시를 함께 무효화한다", () => {
    revalidateMemberData();

    expect(updateTagMock).toHaveBeenCalledWith("member-data");
    expect(updateTagMock).toHaveBeenCalledWith("attendance");
  });
});
