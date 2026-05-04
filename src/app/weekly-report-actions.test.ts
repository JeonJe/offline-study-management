import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createWeeklyReportCycleMock,
  createWeeklyReportTemplateMock,
  deleteAngelWeeklyReportMock,
  deleteWeeklyReportTemplateMock,
  getCurrentRolePageRoleMock,
  isAuthenticatedForUnitMock,
  redirectMock,
  revalidatePathMock,
  updateWeeklyReportCycleMock,
  updateWeeklyReportTemplateMock,
  upsertAngelWeeklyReportMock,
} = vi.hoisted(() => ({
  createWeeklyReportCycleMock: vi.fn(),
  createWeeklyReportTemplateMock: vi.fn(),
  deleteAngelWeeklyReportMock: vi.fn(),
  deleteWeeklyReportTemplateMock: vi.fn(),
  getCurrentRolePageRoleMock: vi.fn(),
  isAuthenticatedForUnitMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  updateWeeklyReportCycleMock: vi.fn(),
  updateWeeklyReportTemplateMock: vi.fn(),
  upsertAngelWeeklyReportMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticatedForUnit: isAuthenticatedForUnitMock,
}));

vi.mock("@/lib/role-session", () => ({
  getCurrentRolePageRole: getCurrentRolePageRoleMock,
}));

vi.mock("@/lib/weekly-report-store", () => ({
  createWeeklyReportCycle: createWeeklyReportCycleMock,
  createWeeklyReportTemplate: createWeeklyReportTemplateMock,
  deleteAngelWeeklyReport: deleteAngelWeeklyReportMock,
  deleteWeeklyReportTemplate: deleteWeeklyReportTemplateMock,
  updateWeeklyReportCycle: updateWeeklyReportCycleMock,
  updateWeeklyReportTemplate: updateWeeklyReportTemplateMock,
  upsertAngelWeeklyReport: upsertAngelWeeklyReportMock,
}));

import {
  deleteAngelWeeklyReportAction,
  submitAngelWeeklyReportAction,
} from "@/app/weekly-report-actions";

describe("weekly-report-actions", () => {
  beforeEach(() => {
    createWeeklyReportCycleMock.mockReset();
    createWeeklyReportTemplateMock.mockReset();
    deleteAngelWeeklyReportMock.mockReset();
    deleteWeeklyReportTemplateMock.mockReset();
    getCurrentRolePageRoleMock.mockReset();
    isAuthenticatedForUnitMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    updateWeeklyReportCycleMock.mockReset();
    updateWeeklyReportTemplateMock.mockReset();
    upsertAngelWeeklyReportMock.mockReset();
  });

  it("redirects unauthenticated report submissions to the cohort entry page", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(false);
    const formData = baseReportForm();
    formData.set("returnPath", "/cohorts/loop-pak-4/angel/reports/cycle-1?team=1");

    await expect(submitAngelWeeklyReportAction(formData)).rejects.toThrow(
      "redirect:/cohorts/loop-pak-4/entry?auth=required&returnPath=%2Fcohorts%2Floop-pak-4%2Fangel%2Freports%2Fcycle-1%3Fteam%3D1%26access%3Drequired"
    );

    expect(upsertAngelWeeklyReportMock).not.toHaveBeenCalled();
  });

  it("appends submitted status to the provided return path", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("angel");
    const formData = baseReportForm();
    formData.set("returnPath", "/cohorts/loop-pak-4/angel/reports/cycle-1?team=1");

    await expect(submitAngelWeeklyReportAction(formData)).rejects.toThrow(
      "redirect:/cohorts/loop-pak-4/angel/reports/cycle-1?team=1&report=submitted"
    );

    expect(upsertAngelWeeklyReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operatingUnitSlug: "loop-pak-4",
        cycleId: "cycle-1",
        teamName: "1팀",
      })
    );
  });

  it("appends unsubmitted status after deleting a report", async () => {
    isAuthenticatedForUnitMock.mockResolvedValue(true);
    getCurrentRolePageRoleMock.mockResolvedValue("admin");
    const formData = baseReportForm();
    formData.set("reportId", "report-1");
    formData.set("returnPath", "/cohorts/loop-pak-4/angel/reports/cycle-1?team=1");

    await expect(deleteAngelWeeklyReportAction(formData)).rejects.toThrow(
      "redirect:/cohorts/loop-pak-4/angel/reports/cycle-1?team=1&report=unsubmitted"
    );

    expect(deleteAngelWeeklyReportMock).toHaveBeenCalledWith("report-1", "loop-pak-4");
    expect(revalidatePathMock).toHaveBeenCalledWith("/angel/reports");
  });
});

function baseReportForm(): FormData {
  const formData = new FormData();
  formData.set("unit", "loop-pak-4");
  formData.set("cycleId", "cycle-1");
  formData.set("angelName", "이순신");
  formData.set("teamName", "1팀");
  formData.set("summary", "팀 현황");
  formData.set("notes", "특이사항");
  formData.set("requests", "요청사항");
  formData.set("actionItems", "");
  return formData;
}
