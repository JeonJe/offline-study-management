import { describe, expect, it } from "vitest";

import {
  buildAfterpartyShareText,
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
          title: "강남 스터디",
          meetingDate: "2026-04-27",
          startTime: "14:00",
          location: "강남역",
          description: "노트북 지참",
          leaders: ["애니"],
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
            name: "민수",
            role: "student",
            note: null,
            createdAt: "2026-04-27",
          },
        ],
      },
      teamLabelByMemberName: new Map([["민수", "1팀"]]),
    });

    expect(text).toContain("[오프라인 모임] 2026-04-27");
    expect(text).toContain("- 장소: 강남역");
    expect(text).toContain("멤버: 1팀 민수");
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
          settlementManager: "유진",
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
            name: "민수",
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
            settlementManager: "유진",
            settlementAccount: "123",
            sortOrder: 0,
            participantCount: 1,
            settledCount: 0,
            createdAt: "2026-04-27",
            updatedAt: "2026-04-27",
          },
        ],
      },
      teamLabelByMemberName: new Map([["민수", "1팀"]]),
    });

    expect(text).toContain("[뒷풀이] 2026-04-27");
    expect(text).toContain("- 정산1: 유진 / 123");
  });
});
