import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { cachedLoadMemberPreset } from "@/lib/cached-queries";
import { MemberAdminForm } from "@/app/members/member-admin-form";
import { DashboardHeader } from "@/app/dashboard-header";

export default async function MembersPage() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const preset = await cachedLoadMemberPreset();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <DashboardHeader
        title="멤버"
        activeTab="members"
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
