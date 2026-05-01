import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticated } from "@/lib/auth";
import { cohortAwarePath } from "@/lib/cohort-routes";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type AngelPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AngelCard = {
  title: string;
  description: string;
  href: string;
  status?: string;
};

const ANGEL_CARDS: AngelCard[] = [
  {
    title: "주간 보고",
    description: "담당 팀 상황 작성",
    href: "/angel/reports",
  },
  {
    title: "오프라인 모임",
    description: "팀 참여 현황 확인",
    href: "/",
  },
  {
    title: "뒷풀이",
    description: "뒷풀이 참석 확인",
    href: "/afterparty",
  },
  {
    title: "담당 팀 히스토리",
    description: "기간별 참여 흐름 확인",
    href: "/angel",
    status: "준비 중",
  },
];

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function AngelHome({ unitSlug }: { unitSlug: string }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {ANGEL_CARDS.map((card) => (
        <Link
          key={card.title}
          href={cohortAwarePath(unitSlug, card.href)}
          className="card p-5"
          aria-disabled={card.status ? "true" : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
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
        </Link>
      ))}
    </section>
  );
}

export default async function AngelPage({ searchParams }: AngelPageProps) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [currentRole, query] = await Promise.all([
    getCurrentRolePageRole(),
    searchParams,
  ]);
  const page = getRolePage("angel");
  const unitSlug = singleParam(query.unit);
  const rolePath = cohortAwarePath(unitSlug, page.path);
  const access = canOpenRolePage("angel", currentRole, getConfiguredRolePages());

  let content;
  if (access === "role-not-configured") {
    content = <RoleNotConfigured label={page.label} />;
  } else if (access === "role-required") {
    content = (
      <RoleAccessRequired
        role="angel"
        label={page.label}
        invalid={singleParam(query.access) === "invalid"}
        returnPath={rolePath}
      />
    );
  } else {
    content = <AngelHome unitSlug={unitSlug} />;
  }

  return (
    <RoleShell
      activeRole="angel"
      title={page.title}
      summary={page.summary}
      unitSlug={unitSlug}
    >
      {content}
    </RoleShell>
  );
}
