import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { loadMemberPreset } from "@/lib/member-store";
import { MemberAdminForm } from "@/app/members/member-admin-form";
import { DashboardHeader } from "@/app/dashboard-header";
import { AddTeamHeaderButton } from "@/app/members/add-team-header-button";

export default async function MembersPage() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const preset = await loadMemberPreset();
  const totalMemberCount = preset.teamGroups.reduce((sum, team) => sum + team.members.length, 0);
  const allAngels = new Set<string>([
    ...preset.fixedAngels,
    ...preset.teamGroups.map((team) => team.angel),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <DashboardHeader
        title="멤버 관리"
        activeTab="members"
        extraActions={<AddTeamHeaderButton />}
      />

      <section className="card-static mb-5 p-5 sm:p-6 fade-in">
        <div className="grid gap-3 sm:grid-cols-3 stagger-children">
          {[
            { label: "팀 수", value: `${preset.teamGroups.length}팀`, accent: "#c2410c" },
            { label: "등록 멤버", value: `${totalMemberCount}명`, accent: "#15803d" },
            { label: "등록 엔젤", value: `${allAngels.size}명`, accent: "#b45309" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-stretch overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
            >
              <div className="w-1.5 shrink-0" style={{ backgroundColor: item.accent }} />
              <div className="px-3 py-3">
                <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{item.label}</p>
                <p className="text-lg font-semibold" style={{ color: "var(--ink)" }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-static p-5 sm:p-6 fade-in">
        <MemberAdminForm
          initialFixedAngels={preset.fixedAngels}
          initialTeamGroups={preset.teamGroups}
        />
      </section>
    </main>
  );
}
