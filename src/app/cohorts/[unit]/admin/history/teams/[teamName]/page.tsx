import TeamHistoryPage from "@/app/admin/history/teams/[teamName]/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortTeamHistoryPageProps = {
  params: Promise<{ unit: string; teamName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortTeamHistoryPage({
  params,
  searchParams,
}: CohortTeamHistoryPageProps) {
  const routeParams = params.then(({ teamName }) => ({ teamName }));
  const unitParams = params.then(({ unit }) => unit);
  return (
    <TeamHistoryPage
      params={routeParams}
      searchParams={withUnitSearchParams(searchParams, await unitParams)}
    />
  );
}
