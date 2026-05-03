import AfterpartyPage from "@/app/afterparty/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortAfterpartyPageProps = {
  params: Promise<{ unit: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortAfterpartyPage({
  params,
  searchParams,
}: CohortAfterpartyPageProps) {
  const { unit } = await params;
  return <AfterpartyPage searchParams={withUnitSearchParams(searchParams, unit)} />;
}
