import AfterpartyDetailPage from "@/app/afterparty/[afterpartyId]/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortAfterpartyDetailPageProps = {
  params: Promise<{ unit: string; afterpartyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortAfterpartyDetailPage({
  params,
  searchParams,
}: CohortAfterpartyDetailPageProps) {
  const routeParams = params.then(({ afterpartyId }) => ({ afterpartyId }));
  const unitParams = params.then(({ unit }) => unit);
  return (
    <AfterpartyDetailPage
      params={routeParams}
      searchParams={withUnitSearchParams(searchParams, await unitParams)}
    />
  );
}
