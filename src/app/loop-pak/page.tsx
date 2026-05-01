import { MeetupDashboard } from "@/app/meetup-dashboard";
import { MEETING_KIND } from "@/lib/meeting-kind";

type SearchParams = Record<string, string | string[] | undefined>;

type LoopPakPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function LoopPakPage({ searchParams }: LoopPakPageProps) {
  return (
    <MeetupDashboard
      searchParams={searchParams}
      activeTab="loopPak"
      title="루프팩"
      basePath="/loop-pak"
      captureTargetId="loop-pak-cards-capture"
      meetingKind={MEETING_KIND.loopPak}
    />
  );
}
