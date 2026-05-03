import MembersPage from "@/app/members/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortMembersPageProps = {
  params: Promise<{ unit: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortMembersPage({
  params,
  searchParams,
}: CohortMembersPageProps) {
  const { unit } = await params;
  return <MembersPage searchParams={withUnitSearchParams(searchParams, unit)} />;
}
