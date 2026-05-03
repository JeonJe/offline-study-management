import Home from "@/app/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortStudyPageProps = {
  params: Promise<{ unit: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortStudyPage({
  params,
  searchParams,
}: CohortStudyPageProps) {
  const { unit } = await params;
  return <Home searchParams={withUnitSearchParams(searchParams, unit)} />;
}
