import LoopPakPage from "@/app/loop-pak/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortLoopPakPageProps = {
  params: Promise<{ unit: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortLoopPakPage({
  params,
  searchParams,
}: CohortLoopPakPageProps) {
  const { unit } = await params;
  return <LoopPakPage searchParams={withUnitSearchParams(searchParams, unit)} />;
}
