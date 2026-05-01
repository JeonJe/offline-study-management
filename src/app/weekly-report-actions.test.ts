import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  addCommentMock,
  getCurrentRolePageRoleMock,
  isAuthenticatedMock,
  listCommentsMock,
  redirectMock,
  revalidatePathMock,
  softDeleteCommentMock,
  verifyRoleScopedTokenMock,
} = vi.hoisted(() => ({
  addCommentMock: vi.fn(),
  getCurrentRolePageRoleMock: vi.fn(),
  isAuthenticatedMock: vi.fn(),
  listCommentsMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  softDeleteCommentMock: vi.fn(),
  verifyRoleScopedTokenMock: vi.fn(),
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
  verifyRoleScopedToken: verifyRoleScopedTokenMock,
}));

vi.mock("@/lib/weekly-report-store", () => ({
  addComment: addCommentMock,
  createWeeklyReportCycle: vi.fn(),
  createWeeklyReportTemplate: vi.fn(),
  deleteWeeklyReportTemplate: vi.fn(),
  listComments: listCommentsMock,
  softDeleteComment: softDeleteCommentMock,
  updateWeeklyReportCycle: vi.fn(),
  updateWeeklyReportTemplate: vi.fn(),
  upsertAngelWeeklyReport: vi.fn(),
}));

import {
  addWeeklyReportCommentAction,
  deleteWeeklyReportCommentAction,
} from "@/app/weekly-report-actions";

function commentForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("reportId", overrides.reportId ?? "report-1");
  formData.set("authorLabel", overrides.authorLabel ?? "애니");
  formData.set("authorToken", overrides.authorToken ?? "valid-token");
  formData.set("body", overrides.body ?? "확인했습니다.");
  formData.set("returnPath", overrides.returnPath ?? "/angel/reports/cycle-1/teams/1%ED%8C%80");
  return formData;
}

function deleteForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("commentId", overrides.commentId ?? "comment-1");
  formData.set("reportId", overrides.reportId ?? "report-1");
  formData.set("authorLabel", overrides.authorLabel ?? "애니");
  formData.set("ownershipToken", overrides.ownershipToken ?? "valid-token");
  formData.set("returnPath", overrides.returnPath ?? "/angel/reports/cycle-1/teams/1%ED%8C%80");
  return formData;
}

describe("weekly report comment server actions", () => {
  beforeEach(() => {
    addCommentMock.mockReset();
    getCurrentRolePageRoleMock.mockReset();
    isAuthenticatedMock.mockReset();
    listCommentsMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    softDeleteCommentMock.mockReset();
    verifyRoleScopedTokenMock.mockReset();
  });

  it("angel 댓글 작성은 서버 서명 author token 없이는 차단한다", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("angel");
    verifyRoleScopedTokenMock.mockReturnValue(false);

    await expect(addWeeklyReportCommentAction(commentForm())).rejects.toThrow(
      "redirect:/angel/reports/cycle-1/teams/1%ED%8C%80?comment=forbidden"
    );

    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("angel 댓글 삭제는 서버 서명 ownership token 없이는 차단한다", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("angel");
    verifyRoleScopedTokenMock.mockReturnValue(false);
    listCommentsMock.mockResolvedValue([
      {
        id: "comment-1",
        reportId: "report-1",
        authorRole: "angel",
        authorLabel: "애니",
        body: "확인했습니다.",
        createdAt: "2026-05-01",
      },
    ]);

    await expect(deleteWeeklyReportCommentAction(deleteForm())).rejects.toThrow(
      "redirect:/angel/reports/cycle-1/teams/1%ED%8C%80?comment=forbidden"
    );

    expect(softDeleteCommentMock).not.toHaveBeenCalled();
  });

  it("admin 댓글 삭제는 ownership token 없이도 허용한다", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    listCommentsMock.mockResolvedValue([
      {
        id: "comment-1",
        reportId: "report-1",
        authorRole: "angel",
        authorLabel: "애니",
        body: "확인했습니다.",
        createdAt: "2026-05-01",
      },
    ]);

    await expect(
      deleteWeeklyReportCommentAction(deleteForm({ ownershipToken: "" }))
    ).rejects.toThrow(
      "redirect:/angel/reports/cycle-1/teams/1%ED%8C%80?comment=deleted"
    );

    expect(softDeleteCommentMock).toHaveBeenCalledWith("comment-1");
  });

  it("admin 댓글 작성은 입력한 이름을 작성자로 저장한다", async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    addCommentMock.mockResolvedValue({
      id: "comment-1",
      reportId: "report-1",
      authorRole: "admin",
      authorLabel: "전제",
      body: "확인했습니다.",
      createdAt: "2026-05-01T14:00:00.000Z",
    });

    await expect(
      addWeeklyReportCommentAction(commentForm({ authorLabel: "전제" }))
    ).rejects.toThrow("redirect:/angel/reports/cycle-1/teams/1%ED%8C%80?comment=created");

    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authorRole: "admin",
        authorLabel: "전제",
        body: "확인했습니다.",
      })
    );
  });
});
