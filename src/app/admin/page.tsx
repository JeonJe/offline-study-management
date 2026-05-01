import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import {
  isAuthenticatedForUnit,
  isGlobalAuthenticated,
} from "@/lib/auth";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AdminCard = {
  title: string;
  description: string;
  href: string;
  status?: string;
};

const COHORT_ADMIN_CARDS: AdminCard[] = [
  {
    title: "엔젤 주간 보고",
    description: "보고 주차 생성, 제출 현황 확인",
    href: "/admin/reports",
  },
  {
    title: "멤버/팀/엔젤 배정",
    description: "팀 구성과 엔젤 배정 관리",
    href: "/members",
  },
  {
    title: "팀/멤버 히스토리",
    description: "기간별 참여 흐름 확인",
    href: "/admin/history",
  },
  {
    title: "오프라인 모임",
    description: "모임 생성과 참석 현황",
    href: "/",
  },
  {
    title: "뒷풀이",
    description: "뒷풀이 생성과 정산",
    href: "/afterparty",
  },
];

const GLOBAL_ADMIN_CARDS: AdminCard[] = [
  {
    title: "기수 관리",
    description: "기수 생성, 상태, 입장 코드 관리",
    href: "/admin/operating-units",
  },
];

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function AdminHome({
  unitSlug,
  scope,
}: {
  unitSlug: string;
  scope: "global" | "cohort";
}) {
  const visibleCards =
    scope === "global"
      ? GLOBAL_ADMIN_CARDS
      : COHORT_ADMIN_CARDS;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleCards.map((card) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3
                className="text-lg font-extrabold"
                style={{ color: card.status ? "var(--ink-muted)" : "var(--ink)" }}
              >
                {card.title}
              </h3>
              {card.status ? (
                <span
                  className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold"
                  style={{
                    borderColor: "var(--line)",
                    color: "var(--ink-muted)",
                    backgroundColor: "var(--surface-alt)",
                  }}
                >
                  {card.status}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              {card.description}
            </p>
          </>
        );

        return card.status ? (
          <div
            key={card.title}
            className="card p-5 cursor-not-allowed"
            aria-disabled="true"
          >
            {body}
          </div>
        ) : (
          <Link key={card.title} href={cohortAwarePath(unitSlug, card.href)} className="card p-5">
            {body}
          </Link>
        );
      })}
    </section>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const [currentRole, query] = await Promise.all([
    getCurrentRolePageRole(),
    searchParams,
  ]);
  const page = getRolePage("admin");
  const unitSlug = singleParam(query.unit);
  const scope = unitSlug ? "cohort" : "global";
  const authenticated =
    scope === "cohort"
      ? await isAuthenticatedForUnit(unitSlug)
      : await isGlobalAuthenticated();
  if (!authenticated) {
    redirect(unitSlug ? `/?auth=required&unit=${encodeURIComponent(unitSlug)}` : "/?auth=required");
  }

  const rolePath = cohortAwarePath(unitSlug, page.path);
  const access = canOpenRolePage("admin", currentRole, getConfiguredRolePages());

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = (
      <RoleAccessRequired
        role="admin"
        label={page.label}
        invalid={singleParam(query.access) === "invalid"}
        returnPath={rolePath}
      />
    );
  } else {
    content = <AdminHome unitSlug={unitSlug} scope={scope} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title={scope === "global" ? "전체 관리자" : page.title}
      summary={
        scope === "global"
          ? "기수 생성과 전체 설정을 관리합니다."
          : "선택한 기수의 팀, 보고, 모임을 관리합니다."
      }
      unitSlug={unitSlug}
      scopeLabel={scope === "global" ? "전체 관리자" : unitSlug}
      showRoleNav={scope === "cohort"}
    >
      {content}
    </RoleShell>
  );
}
