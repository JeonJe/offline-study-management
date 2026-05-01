import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticated } from "@/lib/auth";
import { cohortAwarePath } from "@/lib/cohort-routes";
import { getRolePage } from "@/lib/role-page";

type MemberCard = {
  title: string;
  description: string;
  href: string;
  status?: string;
};

const MEMBER_CARDS: MemberCard[] = [
  {
    title: "오프라인 모임",
    description: "모임 확인, 생성, 참석 관리",
    href: "/",
  },
  {
    title: "뒷풀이",
    description: "뒷풀이 확인, 생성, 참석 관리",
    href: "/afterparty",
  },
];

type MemberPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function MemberHome({ unitSlug }: { unitSlug: string }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {MEMBER_CARDS.map((card) => (
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

export default async function MemberPage({ searchParams }: MemberPageProps) {
  const params = await searchParams;
  const unitSlug = singleParam(params.unit);
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const page = getRolePage("member");

  return (
    <RoleShell
      activeRole="member"
      title={page.title}
      summary={page.summary}
      unitSlug={unitSlug}
    >
      <MemberHome unitSlug={unitSlug} />
    </RoleShell>
  );
}
