import { unstable_cache } from "next/cache";
import {
  listMeetings,
  listMeetingsByKind,
  listMeetingsByKindAndDate,
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
import {
  getTeamAttendanceByPeriod,
  getTeamAttendanceDetailByPeriod,
  getMemberAttendanceByPeriod,
  getMemberAttendanceDetailByPeriod,
} from "@/lib/history-store";
import type { MeetingKind } from "@/lib/meeting-kind";

function isAppCacheDisabled(): boolean {
  return process.env.DISABLE_APP_CACHE === "1";
}

function cacheOrCall<T>(
  fn: () => Promise<T>,
  keys: string[],
  tags: string[]
): Promise<T> {
  if (isAppCacheDisabled()) {
    return fn();
  }

  return unstable_cache(fn, keys, { tags, revalidate: 300 })();
}

// --- meetup-data ---

export const cachedListMeetings = (operatingUnitSlug: string) =>
  cacheOrCall(() => listMeetings(operatingUnitSlug), ["listMeetings", operatingUnitSlug], ["meetup-data"]);

export const cachedListMeetingsByKind = (meetingKind: MeetingKind, operatingUnitSlug: string) =>
  cacheOrCall(
    () => listMeetingsByKind(meetingKind, operatingUnitSlug),
    ["listMeetingsByKind", operatingUnitSlug, meetingKind],
    ["meetup-data"]
  );

export const cachedListMeetingsByKindAndDate = (
  meetingKind: MeetingKind,
  meetingDate: string,
  operatingUnitSlug: string
) =>
  cacheOrCall(
    () => listMeetingsByKindAndDate(meetingKind, meetingDate, operatingUnitSlug),
    ["listMeetingsByKindAndDate", operatingUnitSlug, meetingKind, meetingDate],
    ["meetup-data"]
  );

export const cachedListMeetingsByDate = (meetingDate: string, operatingUnitSlug: string) =>
  cacheOrCall(
    () => listMeetingsByDate(meetingDate, operatingUnitSlug),
    ["listMeetingsByDate", operatingUnitSlug, meetingDate],
    ["meetup-data"]
  );

export const cachedGetMeetingById = (meetingId: string) =>
  cacheOrCall(() => getMeetingById(meetingId), ["getMeetingById", meetingId], ["meetup-data"]);

export const cachedListRsvpsForMeetings = (meetingIds: string[], keyword: string) =>
  cacheOrCall(
    () => listRsvpsForMeetings(meetingIds, keyword),
    ["listRsvpsForMeetings", ...meetingIds.sort(), keyword],
    ["meetup-data"]
  );

// --- member-data ---

export const cachedLoadMemberPreset = (operatingUnitSlug: string) =>
  cacheOrCall(() => loadMemberPreset(operatingUnitSlug), ["loadMemberPreset", operatingUnitSlug], ["member-data"]);

// --- afterparty-data ---

export const cachedListAfterparties = (operatingUnitSlug: string) =>
  cacheOrCall(() => listAfterparties(operatingUnitSlug), ["listAfterparties", operatingUnitSlug], ["afterparty-data"]);

export const cachedListAfterpartiesByDate = (eventDate: string, operatingUnitSlug: string) =>
  cacheOrCall(
    () => listAfterpartiesByDate(eventDate, operatingUnitSlug),
    ["listAfterpartiesByDate", operatingUnitSlug, eventDate],
    ["afterparty-data"]
  );

export const cachedGetAfterpartyById = (afterpartyId: string) =>
  cacheOrCall(() => getAfterpartyById(afterpartyId), ["getAfterpartyById", afterpartyId], ["afterparty-data"]);

export const cachedListParticipantsForAfterparties = (afterpartyIds: string[], keyword: string) =>
  cacheOrCall(
    () => listParticipantsForAfterparties(afterpartyIds, keyword),
    ["listParticipantsForAfterparties", ...afterpartyIds.sort(), keyword],
    ["afterparty-data"]
  );

export const cachedListSettlementsForAfterparty = (afterpartyId: string) =>
  cacheOrCall(
    () => listSettlementsForAfterparty(afterpartyId),
    ["listSettlementsForAfterparty", afterpartyId],
    ["afterparty-data"]
  );

export const cachedListSettlementsForAfterparties = (afterpartyIds: string[]) =>
  cacheOrCall(
    () => listSettlementsForAfterparties(afterpartyIds),
    ["listSettlementsForAfterparties", ...afterpartyIds.sort()],
    ["afterparty-data"]
  );

export const cachedListParticipantsForSettlement = (settlementId: string, keyword: string) =>
  cacheOrCall(
    () => listParticipantsForSettlement(settlementId, keyword),
    ["listParticipantsForSettlement", settlementId, keyword],
    ["afterparty-data"]
  );

// --- attendance ---

export const cachedGetTeamAttendanceByPeriod = (start: string, end: string, operatingUnitSlug: string) =>
  cacheOrCall(
    () => getTeamAttendanceByPeriod(start, end, operatingUnitSlug),
    ["getTeamAttendanceByPeriod", start, end, operatingUnitSlug],
    ["attendance"]
  );

export const cachedGetMemberAttendanceByPeriod = (start: string, end: string, operatingUnitSlug: string) =>
  cacheOrCall(
    () => getMemberAttendanceByPeriod(start, end, operatingUnitSlug),
    ["getMemberAttendanceByPeriod", start, end, operatingUnitSlug],
    ["attendance"]
  );

export const cachedGetTeamAttendanceDetailByPeriod = (
  teamName: string,
  start: string,
  end: string,
  operatingUnitSlug: string
) =>
  cacheOrCall(
    () => getTeamAttendanceDetailByPeriod(teamName, start, end, operatingUnitSlug),
    ["getTeamAttendanceDetailByPeriod", teamName, start, end, operatingUnitSlug],
    ["attendance"]
  );

export const cachedGetMemberAttendanceDetailByPeriod = (
  name: string,
  start: string,
  end: string,
  operatingUnitSlug: string
) =>
  cacheOrCall(
    () => getMemberAttendanceDetailByPeriod(name, start, end, operatingUnitSlug),
    ["getMemberAttendanceDetailByPeriod", name, start, end, operatingUnitSlug],
    ["attendance"]
  );
