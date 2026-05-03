import MeetingDetailPage from "@/app/meetings/[meetingId]/page";
import { withUnitSearchParams } from "@/lib/cohort-page-params";

type CohortMeetingDetailPageProps = {
  params: Promise<{ unit: string; meetingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CohortMeetingDetailPage({
  params,
  searchParams,
}: CohortMeetingDetailPageProps) {
  const routeParams = params.then(({ meetingId }) => ({ meetingId }));
  const unitParams = params.then(({ unit }) => unit);
  return (
    <MeetingDetailPage
      params={routeParams}
      searchParams={withUnitSearchParams(searchParams, await unitParams)}
    />
  );
}
