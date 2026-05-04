import { describe, expect, it } from "vitest";

import {
  buildAfterpartyShareText,
  buildMeetingShareText,
  buildOfflineStudyShareText,
} from "@/lib/share-text";

describe("share text builders", () => {
  it("builds concise offline study share text", () => {
    const text = buildOfflineStudyShareText({
      selectedDate: "2026-04-27",
      meetingsOnDate: [
        {
          id: "meeting-1",
          operatingUnitSlug: "default",
          meetingKind: "study",
          title: "강남 스터디",
          meetingDate: "2026-04-27",
          startTime: "14:00",
          location: "강남역",
          description: "노트북 지참",
          leaders: ["유관순"],
          hasPassword: false,
          capacity: null,
          studentCount: 1,
          operationCount: 1,
          totalCount: 2,
        },
      ],
      rsvpsByMeeting: {
        "meeting-1": [
          {
            id: "rsvp-1",
            meetingId: "meeting-1",
            name: "장영실",
            role: "student",
            status: "confirmed",
            note: null,
            createdAt: "2026-04-27",
          },
        ],
      },
      teamLabelByMemberName: new Map([["장영실", "1팀"]]),
    });

    expect(text).toContain("[오프라인 모임] 2026-04-27");
    expect(text).toContain("- 장소: 강남역");
    expect(text).toContain("멤버: 1팀 장영실");
  });

  it("builds afterparty share text with settlement info", () => {
    const text = buildAfterpartyShareText({
      selectedDate: "2026-04-27",
      afterpartiesOnDate: [
        {
          id: "afterparty-1",
          operatingUnitSlug: "default",
          title: "홍대 뒷풀이",
          eventDate: "2026-04-27",
          startTime: "19:00",
          location: "홍대입구",
          description: null,
          settlementManager: "정약용",
          settlementAccount: "123",
          hasPassword: false,
          participantCount: 1,
          settlementCount: 1,
        },
      ],
      participantsByAfterparty: {
        "afterparty-1": [
          {
            id: "participant-1",
            afterpartyId: "afterparty-1",
            name: "장영실",
            role: "student",
            isSettled: false,
            createdAt: "2026-04-27",
          },
        ],
      },
      settlementsByAfterparty: {
        "afterparty-1": [
          {
            id: "settlement-1",
            afterpartyId: "afterparty-1",
            title: "1차",
            settlementManager: "정약용",
            settlementAccount: "123",
            sortOrder: 0,
            participantCount: 1,
            settledCount: 0,
            createdAt: "2026-04-27",
          },
        ],
      },
      teamLabelByMemberName: new Map([["장영실", "1팀"]]),
    });

    expect(text).toContain("[뒷풀이] 2026-04-27");
    expect(text).toContain("- 정산1: 정약용 / 123");
  });

  it("builds a single meeting share text with capacity and waitlist", () => {
    const text = buildMeetingShareText({
      meeting: {
        id: "meeting-1",
        operatingUnitSlug: "default",
        meetingKind: "study",
        title: "강남 스터디",
        meetingDate: "2026-04-27",
        startTime: "14:00",
        location: "강남역 https://naver.me/abc",
        description: "노트북 지참",
        leaders: ["유관순"],
        hasPassword: false,
        capacity: 1,
        studentCount: 1,
        operationCount: 0,
        totalCount: 1,
      },
      rsvps: [
        {
          id: "rsvp-1",
          meetingId: "meeting-1",
          name: "장영실",
          role: "student",
          status: "confirmed",
          note: null,
          createdAt: "2026-04-27",
        },
        {
          id: "rsvp-2",
          meetingId: "meeting-1",
          name: "신사임당",
          role: "student",
          status: "waitlist",
          note: null,
          createdAt: "2026-04-27",
        },
      ],
      teamLabelByMemberName: new Map([
        ["장영실", "1팀"],
        ["신사임당", "2팀"],
      ]),
    });

    expect(text).toContain("[모임] 강남 스터디");
    expect(text).toContain("- 참여: 확정 1명 / 정원 1명");
    expect(text).toContain("- 멤버: 1팀 장영실");
    expect(text).toContain("- 대기: 2팀 신사임당");
    expect(text).toContain("- 지도 링크: https://naver.me/abc");
  });
});
