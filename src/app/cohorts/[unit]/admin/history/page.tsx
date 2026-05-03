import HistoryPage from "@/app/admin/history/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortHistoryPageProps = {
  params: Promise<{ unit: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortHistoryPage({
  params,
  searchParams,
}: CohortHistoryPageProps) {
  const { unit } = await params;
  return <HistoryPage searchParams={withUnitSearchParams(searchParams, unit)} />;
}
