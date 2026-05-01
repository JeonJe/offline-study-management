import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { cachedLoadMemberPreset } from "@/lib/cached-queries";
import { MemberAdminForm } from "@/app/members/member-admin-form";
import { DashboardHeader } from "@/app/dashboard-header";

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
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const preset = await cachedLoadMemberPreset();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
      <DashboardHeader
        title="멤버"
        activeTab="members"
        unitSlug={unitSlug}
      />

      <section className="card-static p-5 sm:p-7 fade-in">
        <MemberAdminForm
          initialFixedAngels={preset.fixedAngels}
          initialTeamGroups={preset.teamGroups}
          initialSpecialRoles={preset.specialRoles}
        />
      </section>
    </main>
  );
}
