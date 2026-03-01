import { unstable_cache } from "next/cache";
import {
  listMeetings,
  listMeetingsByDate,
  getMeetingById,
  listRsvpsForMeetings,
} from "@/lib/meetup-store";
import { loadMemberPreset } from "@/lib/member-store";
import {
  listAfterparties,
  listAfterpartiesByDate,
  getAfterpartyById,
  listParticipantsForAfterparties,
  listSettlementsForAfterparty,
  listSettlementsForAfterparties,
  listParticipantsForSettlement,
} from "@/lib/afterparty-store";

// --- meetup-data ---

export const cachedListMeetings = unstable_cache(
  listMeetings,
  ["listMeetings"],
  { tags: ["meetup-data"], revalidate: 300 }
);

export const cachedListMeetingsByDate = (meetingDate: string) =>
  unstable_cache(
    () => listMeetingsByDate(meetingDate),
    ["listMeetingsByDate", meetingDate],
    { tags: ["meetup-data"], revalidate: 300 }
  )();

export const cachedGetMeetingById = (meetingId: string) =>
  unstable_cache(
    () => getMeetingById(meetingId),
    ["getMeetingById", meetingId],
    { tags: ["meetup-data"], revalidate: 300 }
  )();

export const cachedListRsvpsForMeetings = (meetingIds: string[], keyword: string) =>
  unstable_cache(
    () => listRsvpsForMeetings(meetingIds, keyword),
    ["listRsvpsForMeetings", ...meetingIds.sort(), keyword],
    { tags: ["meetup-data"], revalidate: 300 }
  )();

// --- member-data ---

export const cachedLoadMemberPreset = unstable_cache(
  loadMemberPreset,
  ["loadMemberPreset"],
  { tags: ["member-data"], revalidate: 300 }
);

// --- afterparty-data ---

export const cachedListAfterparties = unstable_cache(
  listAfterparties,
  ["listAfterparties"],
  { tags: ["afterparty-data"], revalidate: 300 }
);

export const cachedListAfterpartiesByDate = (eventDate: string) =>
  unstable_cache(
    () => listAfterpartiesByDate(eventDate),
    ["listAfterpartiesByDate", eventDate],
    { tags: ["afterparty-data"], revalidate: 300 }
  )();

export const cachedGetAfterpartyById = (afterpartyId: string) =>
  unstable_cache(
    () => getAfterpartyById(afterpartyId),
    ["getAfterpartyById", afterpartyId],
    { tags: ["afterparty-data"], revalidate: 300 }
  )();

export const cachedListParticipantsForAfterparties = (afterpartyIds: string[], keyword: string) =>
  unstable_cache(
    () => listParticipantsForAfterparties(afterpartyIds, keyword),
    ["listParticipantsForAfterparties", ...afterpartyIds.sort(), keyword],
    { tags: ["afterparty-data"], revalidate: 300 }
  )();

export const cachedListSettlementsForAfterparty = (afterpartyId: string) =>
  unstable_cache(
    () => listSettlementsForAfterparty(afterpartyId),
    ["listSettlementsForAfterparty", afterpartyId],
    { tags: ["afterparty-data"], revalidate: 300 }
  )();

export const cachedListSettlementsForAfterparties = (afterpartyIds: string[]) =>
  unstable_cache(
    () => listSettlementsForAfterparties(afterpartyIds),
    ["listSettlementsForAfterparties", ...afterpartyIds.sort()],
    { tags: ["afterparty-data"], revalidate: 300 }
  )();

export const cachedListParticipantsForSettlement = (settlementId: string, keyword: string) =>
  unstable_cache(
    () => listParticipantsForSettlement(settlementId, keyword),
    ["listParticipantsForSettlement", settlementId, keyword],
    { tags: ["afterparty-data"], revalidate: 300 }
  )();
