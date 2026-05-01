import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isGlobalAuthenticated } from "@/lib/auth";
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

const GLOBAL_ADMIN_CARDS: AdminCard[] = [
  {
    title: "목록 관리",
    description: "이름, 주소, 입장 코드 관리",
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
  cards,
}: {
  cards: AdminCard[];
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
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
          <Link key={card.title} href={card.href} className="card p-5">
            {body}
          </Link>
        );
      })}
    </section>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const [currentRole, query] = await Promise.all([
    getCurrentRolePageRole(),
    searchParams,
  ]);
  const page = getRolePage("admin");
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
        returnPath="/admin"
      />
    );
  } else {
    content = <AdminHome cards={GLOBAL_ADMIN_CARDS} />;
  }

  return (
    <RoleShell
      activeRole="admin"
      title="전체 관리자"
      summary="목록 생성과 전체 설정을 관리합니다."
      scopeLabel="전체 관리자"
      showRoleNav={false}
    >
      {content}
    </RoleShell>
  );
}
