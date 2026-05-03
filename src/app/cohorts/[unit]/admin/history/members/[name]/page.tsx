import MemberHistoryPage from "@/app/admin/history/members/[name]/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortMemberHistoryPageProps = {
  params: Promise<{ unit: string; name: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortMemberHistoryPage({
  params,
  searchParams,
}: CohortMemberHistoryPageProps) {
  const routeParams = params.then(({ name }) => ({ name }));
  const unitParams = params.then(({ unit }) => unit);
  return (
    <MemberHistoryPage
      params={routeParams}
      searchParams={withUnitSearchParams(searchParams, await unitParams)}
    />
  );
}
