import { redirect } from "next/navigation";
import { isAuthenticatedForUnit } from "@/lib/auth";
import { cachedLoadMemberPreset } from "@/lib/cached-queries";
import { MemberAdminForm } from "@/app/members/member-admin-form";
import { DashboardHeader } from "@/app/dashboard-header";
import { cohortAwarePath, cohortEntryLoginPath } from "@/lib/cohort-routes";
import { getCurrentRolePageRole } from "@/lib/role-session";

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
  if (currentRole !== "admin") {
    redirect(`${cohortAwarePath(unitSlug, "/members")}?access=required`);
  }

  const preset = await cachedLoadMemberPreset(unitSlug);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
      <DashboardHeader
        title="멤버 관리"
        activeTab="admin"
        unitSlug={unitSlug}
      />

      <section className="fade-in">
        <MemberAdminForm
          operatingUnitSlug={unitSlug}
          initialFixedAngels={preset.fixedAngels}
          initialTeamGroups={preset.teamGroups}
          initialSpecialRoles={preset.specialRoles}
        />
      </section>
    </main>
  );
}
