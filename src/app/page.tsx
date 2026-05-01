import { MeetupDashboard } from "@/app/meetup-dashboard";
import { MEETING_KIND } from "@/lib/meeting-kind";

type SearchParams = Record<string, string | string[] | undefined>;

type HomePageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Home({ searchParams }: HomePageProps) {
  return (
    <MeetupDashboard
      searchParams={searchParams}
      activeTab="study"
      title="스터디"
      basePath="/"
      captureTargetId="offline-study-cards-capture"
      meetingKind={MEETING_KIND.study}
    />
  );
}
