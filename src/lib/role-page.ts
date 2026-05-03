export type RolePageRole = "member" | "angel" | "admin";

export type RoleAccessReason =
  | "allowed"
  | "role-required"
  | "role-not-configured";

export type RolePageLink = {
  label: string;
  href: string;
  description: string;
};

export type RolePageSection = {
  title: string;
  description: string;
  links: RolePageLink[];
};

export type RolePageDefinition = {
  role: RolePageRole;
  label: string;
  path: string;
  title: string;
  summary: string;
  badge: string;
  sections: RolePageSection[];
};

export type ConfiguredRolePages = {
  angel: boolean;
  admin: boolean;
};

const ROLE_ORDER: Record<RolePageRole, number> = {
  member: 1,
  angel: 2,
  admin: 3,
};

export const ROLE_PAGES: RolePageDefinition[] = [
  {
    role: "member",
    label: "멤버",
    path: "/member",
    title: "멤버 페이지",
    summary: "모임과 뒷풀이를 확인합니다.",
    badge: "참여",
    sections: [
      {
        title: "공용 모임",
        description: "모임과 뒷풀이는 모두가 자유롭게 관리합니다.",
        links: [
          {
            label: "오프라인 모임",
            href: "/",
            description: "모임 생성, 장소 확인, 참석 현황 관리",
          },
          {
            label: "뒷풀이",
            href: "/afterparty",
            description: "뒷풀이 생성, 참석 현황, 정산 관리",
          },
        ],
      },
    ],
  },
  {
    role: "angel",
    label: "엔젤",
    path: "/angel",
    title: "엔젤 페이지",
    summary: "담당 팀 보고를 작성합니다.",
    badge: "팀 현황",
    sections: [
      {
        title: "담당 팀",
        description: "담당 팀의 주간 보고를 작성합니다.",
        links: [
          {
            label: "주간 보고",
            href: "/angel/reports",
            description: "팀 현황과 특이사항 작성",
          },
        ],
      },
    ],
  },
  {
    role: "admin",
    label: "관리자",
    path: "/admin",
    title: "관리자 페이지",
    summary: "팀과 보고를 관리합니다.",
    badge: "운영",
    sections: [
      {
        title: "운영 관리",
        description: "운영 구조와 보고 현황을 관리합니다.",
        links: [
          {
            label: "멤버/팀/엔젤 배정",
            href: "/members",
            description: "멤버, 팀, 엔젤 배정",
          },
          {
            label: "엔젤 보고 현황",
            href: "/admin/reports",
            description: "주차별 제출 현황 확인",
          },
          {
            label: "참여 통계",
            href: "/admin/history",
            description: "팀과 멤버의 참여율 확인",
          },
        ],
      },
    ],
  },
];

export function normalizeRolePageRole(value: string | null | undefined): RolePageRole | null {
  if (value === "member" || value === "angel" || value === "admin") {
    return value;
  }

  return null;
}

export function listRolePages(): RolePageDefinition[] {
  return ROLE_PAGES;
}

export function getRolePage(role: RolePageRole): RolePageDefinition {
  return ROLE_PAGES.find((page) => page.role === role) ?? ROLE_PAGES[0];
}

export function canOpenRolePage(
  requestedRole: RolePageRole,
  currentRole: RolePageRole | null,
  configuredRoles: ConfiguredRolePages
): RoleAccessReason {
  if (requestedRole === "member") {
    return "allowed";
  }

  if (currentRole && ROLE_ORDER[currentRole] >= ROLE_ORDER[requestedRole]) {
    return "allowed";
  }

  if (!configuredRoles[requestedRole]) {
    return "role-not-configured";
  }

  return "role-required";
}
