import { redirect } from "next/navigation";
import {
  RoleAccessRequired,
  RoleNotConfigured,
} from "@/app/role-page-view";
import { RoleShell } from "@/app/role-shell";
import { isAuthenticatedForUnit } from "@/lib/auth";
import { cachedLoadMemberPreset } from "@/lib/cached-queries";
import { MemberAdminForm } from "@/app/members/member-admin-form";
import { cohortAwarePath, cohortEntryLoginPath } from "@/lib/cohort-routes";
import {
  canOpenRolePage,
  getRolePage,
} from "@/lib/role-page";
import {
  getConfiguredRolePages,
  getCurrentRolePageRole,
} from "@/lib/role-session";

type MembersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const params = await searchParams;
  const unitSlug = singleParam(params.unit);
  const authenticated = await isAuthenticatedForUnit(unitSlug);
  if (!authenticated) {
    redirect(cohortEntryLoginPath(unitSlug, { auth: "required", returnPath: cohortAwarePath(unitSlug, "/members") }));
  }

  const currentRole = await getCurrentRolePageRole(unitSlug);
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
        invalid={singleParam(params.access) === "invalid"}
        returnPath={cohortAwarePath(unitSlug, "/members")}
        unitSlug={unitSlug}
      />
    );
  } else {
    const preset = await cachedLoadMemberPreset(unitSlug);
    content = (
      <section className="fade-in">
        <MemberAdminForm
          operatingUnitSlug={unitSlug}
          initialFixedAngels={preset.fixedAngels}
          initialTeamGroups={preset.teamGroups}
          initialSpecialRoles={preset.specialRoles}
        />
      </section>
    );
  }

  return (
    <RoleShell
      activeRole="admin"
      title="멤버 관리"
      summary="팀과 멤버, 운영진 역할을 관리합니다."
      unitSlug={unitSlug}
    >
      {content}
    </RoleShell>
  );
}
