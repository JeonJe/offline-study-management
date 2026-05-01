import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticatedForUnit } from "@/lib/auth";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type CohortAdminPageProps = {
  params: Promise<{ unit: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AdminCard = {
  title: string;
  description: string;
  href: string;
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

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function CohortAdminHome({ unitSlug }: { unitSlug: string }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {COHORT_ADMIN_CARDS.map((card) => (
        <Link
          key={card.title}
          href={cohortAwarePath(unitSlug, card.href)}
          className="card p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
              {card.title}
            </h3>
          </div>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
            {card.description}
          </p>
        </Link>
      ))}
    </section>
  );
}

export default async function CohortAdminPage({
  params,
  searchParams,
}: CohortAdminPageProps) {
  const [{ unit }, query] = await Promise.all([params, searchParams]);
  const authenticated = await isAuthenticatedForUnit(unit);
  if (!authenticated) {
    redirect(`/?auth=required&unit=${encodeURIComponent(unit)}`);
  }

  const currentRole = await getCurrentRolePageRole();
  const page = getRolePage("admin");
  const rolePath = cohortAwarePath(unit, page.path);
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
    content = <CohortAdminHome unitSlug={unit} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="관리자"
      summary="선택한 이름의 팀, 보고, 모임을 관리합니다."
      unitSlug={unit}
      scopeLabel={unit}
    >
      {content}
    </RoleShell>
  );
}
