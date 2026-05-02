import { query } from "@/lib/db";
import { requireOperatingUnitSlug } from "@/lib/operating-unit-store";
import { ensureSchema } from "@/lib/meetup-store";
import { ensureAfterpartySchema } from "@/lib/afterparty-store";
import { compareText, compareTextDesc } from "@/lib/sort-utils";

/**
 * 팀별 기간 출석 집계 결과 행
 */
export type TeamAttendanceRow = {
  /** 팀 이름 (member_teams.team_name) */
  team: string;
  /** 기간 내 전체 모임 수 */
  meetings: number;
  /** 해당 팀 멤버가 1명 이상 rsvp한 모임 수 */
  attended: number;
  /** 출석률 (attended / meetings, 0–1, 소수점 2자리) */
  rate: number;
};

export type TeamAttendanceDetailItem = {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  attendedMembers: number;
  attendees: string[];
};

export type TeamAttendanceDetail = {
  team: string;
  meetings: number;
  attended: number;
  rate: number;
  members: string[];
  items: TeamAttendanceDetailItem[];
};

/**
 * 멤버별 기간 출석 집계 결과 행
 */
export type MemberAttendanceRow = {
  /** 멤버 이름 */
  name: string;
  /** rsvp가 존재하는 모임 수 */
  meetings: number;
  /** afterparty_participants에 이름이 존재하는 뒷풀이 수 */
  afterparties: number;
};

export type MemberAttendanceDetailItem = {
  id: string;
  kind: "meeting" | "afterparty";
  title: string;
  eventDate: string;
  startTime: string;
  role: string;
};

export type MemberAttendanceDetail = {
  name: string;
  meetings: number;
  afterparties: number;
  totalMeetings: number;
  totalAfterparties: number;
  items: MemberAttendanceDetailItem[];
};

/**
 * 기간별 팀 출석률을 집계한다.
 *
 * - meetings 테이블에서 meeting_date BETWEEN start AND end 로 기간 필터
 * - member_teams + member_team_members JOIN으로 팀-멤버 매핑 확보
 * - rsvps LEFT JOIN으로 각 모임에 팀원 참석 여부 판정
 * - operatingUnitSlug는 주소/폼에서 전달된 명시 운영 단위만 허용
 * - meetings가 0건이면 빈 배열 반환 (division by zero 방지)
 *
 * @param start 시작일 (ISO date string, 포함)
 * @param end 종료일 (ISO date string, 포함)
 * @param operatingUnitSlug 주소 식별자
 */
export async function getTeamAttendanceByPeriod(
  start: string,
  end: string,
  operatingUnitSlug: string
): Promise<TeamAttendanceRow[]> {
  await ensureSchema();
  const unitSlug = requireOperatingUnitSlug(operatingUnitSlug);

  const meetingRows = await query<{ id: string }>(
    `select id
     from public.meetings
     where meeting_date between $1 and $2
       and coalesce(operating_unit_slug, $3) = $3`,
    [start, end, unitSlug]
  );

  const totalMeetings = meetingRows.length;
  if (totalMeetings === 0) return [];

  const meetingIds = meetingRows.map((r) => r.id);

  const [memberRows, rsvpRows] = await Promise.all([
    query<{ teamName: string; memberName: string }>(
      `select
         t.team_name as "teamName",
         m.member_name as "memberName"
       from public.member_teams t
       join public.member_team_members m on m.team_name = t.team_name
         and coalesce(m.operating_unit_slug, $1) = $1
       where coalesce(t.operating_unit_slug, $1) = $1
       order by t.team_name, m.member_order asc, m.member_name asc`,
      [unitSlug]
    ),
    query<{ meetingId: string; name: string }>(
      `select
         meeting_id::text as "meetingId",
         lower(name) as name
       from public.rsvps
       where meeting_id = any($1::uuid[])`,
      [meetingIds]
    ),
  ]);

  const meetingIdsByMemberName = new Map<string, Set<string>>();
  for (const row of rsvpRows) {
    const meetingSet = meetingIdsByMemberName.get(row.name) ?? new Set<string>();
    meetingSet.add(row.meetingId);
    meetingIdsByMemberName.set(row.name, meetingSet);
  }

  const attendedMeetingIdsByTeam = new Map<string, Set<string>>();
  for (const row of memberRows) {
    const teamSet = attendedMeetingIdsByTeam.get(row.teamName) ?? new Set<string>();
    const memberMeetingIds = meetingIdsByMemberName.get(row.memberName.toLowerCase()) ?? new Set<string>();
    for (const meetingId of memberMeetingIds) {
      teamSet.add(meetingId);
    }
    attendedMeetingIdsByTeam.set(row.teamName, teamSet);
  }

  return Array.from(attendedMeetingIdsByTeam.entries()).map(([team, attendedMeetingIds]) => {
    const attended = attendedMeetingIds.size;
    return {
      team,
      meetings: totalMeetings,
      attended,
      rate: Math.round((attended / totalMeetings) * 100) / 100,
    };
  });
}

/**
 * 기간별 멤버 출석 집계를 반환한다.
 *
 * - rsvps + meetings JOIN으로 기간 내 모임 참석 집계 (name 기준 GROUP BY)
 * - afterparty_participants + afterparties JOIN으로 기간 내 뒷풀이 참석 집계
 * - 두 결과를 애플리케이션 레벨 Map<name, row>으로 merge (FULL OUTER JOIN 대체)
 * - lower(name) 매칭으로 대소문자 차이 흡수
 * - operatingUnitSlug는 주소/폼에서 전달된 명시 운영 단위만 허용
 *
 * @param start 시작일 (ISO date string, 포함)
 * @param end 종료일 (ISO date string, 포함)
 * @param operatingUnitSlug 주소 식별자
 */
export async function getMemberAttendanceByPeriod(
  start: string,
  end: string,
  operatingUnitSlug: string
): Promise<MemberAttendanceRow[]> {
  await ensureSchema();
  await ensureAfterpartySchema();
  const unitSlug = requireOperatingUnitSlug(operatingUnitSlug);

  // 모임 참석 집계 (rsvps + meetings)
  const meetingAttendance = await query<{ name: string; meetings: string }>(
    `select
       lower(r.name) as name,
       count(distinct r.meeting_id)::text as meetings
     from public.rsvps r
     join public.meetings m on m.id = r.meeting_id
     where m.meeting_date between $1 and $2
       and coalesce(m.operating_unit_slug, $3) = $3
     group by lower(r.name)`,
    [start, end, unitSlug]
  );

  // 뒷풀이 참석 집계 (afterparty_participants + afterparties)
  const afterpartyAttendance = await query<{ name: string; afterparties: string }>(
    `select
       lower(ap.name) as name,
       count(distinct ap.afterparty_id)::text as afterparties
     from public.afterparty_participants ap
     join public.afterparties a on a.id = ap.afterparty_id
     where a.event_date between $1 and $2
       and coalesce(a.operating_unit_slug, $3) = $3
     group by lower(ap.name)`,
    [start, end, unitSlug]
  );

  // 애플리케이션 레벨 merge (lower(name) 기준)
  const map = new Map<string, MemberAttendanceRow>();

  for (const row of meetingAttendance) {
    map.set(row.name, {
      name: row.name,
      meetings: parseInt(row.meetings, 10),
      afterparties: 0,
    });
  }

  for (const row of afterpartyAttendance) {
    const existing = map.get(row.name);
    if (existing) {
      existing.afterparties = parseInt(row.afterparties, 10);
    } else {
      map.set(row.name, {
        name: row.name,
        meetings: 0,
        afterparties: parseInt(row.afterparties, 10),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => compareText(a.name, b.name));
}

export async function getTeamAttendanceDetailByPeriod(
  teamName: string,
  start: string,
  end: string,
  operatingUnitSlug: string
): Promise<TeamAttendanceDetail> {
  await ensureSchema();
  const unitSlug = requireOperatingUnitSlug(operatingUnitSlug);

  const normalizedTeamName = teamName.trim();
  if (!normalizedTeamName) {
    return { team: "", meetings: 0, attended: 0, rate: 0, members: [], items: [] };
  }

  const memberRows = await query<{ memberName: string }>(
    `select member_name as "memberName"
     from public.member_team_members
     where team_name = $1
       and coalesce(operating_unit_slug, $2) = $2
     order by member_order asc, member_name asc`,
    [normalizedTeamName, unitSlug]
  );
  const members = memberRows.map((row) => row.memberName);

  const meetingRows = await query<{
    id: string;
    title: string;
    eventDate: string;
    startTime: string;
  }>(
    `select
       m.id::text as id,
       m.title,
       m.meeting_date::text as "eventDate",
       m.start_time::text as "startTime"
     from public.meetings m
     where m.meeting_date between $1 and $2
       and coalesce(m.operating_unit_slug, $3) = $3
     order by m.meeting_date desc, m.start_time desc, m.title asc`,
    [start, end, unitSlug]
  );

  const normalizedMembers = members.map((member) => member.toLowerCase());
  const rsvpRows =
    meetingRows.length > 0 && normalizedMembers.length > 0
      ? await query<{ meetingId: string; name: string }>(
          `select
             meeting_id::text as "meetingId",
             name
           from public.rsvps
           where meeting_id = any($1::uuid[])
             and lower(name) = any($2::text[])
           order by name asc`,
          [meetingRows.map((row) => row.id), normalizedMembers]
        )
      : [];

  const attendeesByMeetingId = new Map<string, Set<string>>();
  for (const row of rsvpRows) {
    const attendees = attendeesByMeetingId.get(row.meetingId) ?? new Set<string>();
    attendees.add(row.name);
    attendeesByMeetingId.set(row.meetingId, attendees);
  }

  const items: TeamAttendanceDetailItem[] = meetingRows.map((row) => {
    const attendees = Array.from(attendeesByMeetingId.get(row.id) ?? new Set<string>()).sort(compareText);
    return {
      ...row,
      attendedMembers: attendees.length,
      attendees,
    };
  });

  const attended = items.filter((row) => row.attendedMembers > 0).length;
  const meetings = items.length;

  return {
    team: normalizedTeamName,
    meetings,
    attended,
    rate: meetings > 0 ? Math.round((attended / meetings) * 100) / 100 : 0,
    members,
    items,
  };
}

export async function getMemberAttendanceDetailByPeriod(
  name: string,
  start: string,
  end: string,
  operatingUnitSlug: string
): Promise<MemberAttendanceDetail> {
  await ensureSchema();
  await ensureAfterpartySchema();
  const unitSlug = requireOperatingUnitSlug(operatingUnitSlug);

  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return { name: "", meetings: 0, afterparties: 0, totalMeetings: 0, totalAfterparties: 0, items: [] };
  }

  const [
    meetingRows,
    afterpartyRows,
    meetingTotalRows,
    afterpartyTotalRows,
  ] = await Promise.all([
    query<MemberAttendanceDetailItem>(
      `select
         m.id::text as id,
         'meeting' as kind,
         m.title,
         m.meeting_date::text as "eventDate",
         m.start_time::text as "startTime",
         r.role::text as role
       from public.rsvps r
       join public.meetings m on m.id = r.meeting_id
       where lower(r.name) = $1
         and m.meeting_date between $2 and $3
         and coalesce(m.operating_unit_slug, $4) = $4
       order by m.meeting_date desc, m.start_time desc, m.title asc`,
      [normalizedName, start, end, unitSlug]
    ),
    query<MemberAttendanceDetailItem>(
      `select
         a.id::text as id,
         'afterparty' as kind,
         a.title,
         a.event_date::text as "eventDate",
         a.start_time::text as "startTime",
         ap.role::text as role
       from public.afterparty_participants ap
       join public.afterparties a on a.id = ap.afterparty_id
       where lower(ap.name) = $1
         and a.event_date between $2 and $3
         and coalesce(a.operating_unit_slug, $4) = $4
       order by a.event_date desc, a.start_time desc, a.title asc`,
      [normalizedName, start, end, unitSlug]
    ),
    query<{ count: string }>(
      `select count(distinct id)::text as count
       from public.meetings
       where meeting_date between $1 and $2
         and coalesce(operating_unit_slug, $3) = $3`,
      [start, end, unitSlug]
    ),
    query<{ count: string }>(
      `select count(distinct id)::text as count
       from public.afterparties
       where event_date between $1 and $2
         and coalesce(operating_unit_slug, $3) = $3`,
      [start, end, unitSlug]
    ),
  ]);

  const items = [...meetingRows, ...afterpartyRows].sort((a, b) => {
    if (a.eventDate !== b.eventDate) return compareTextDesc(a.eventDate, b.eventDate);
    if (a.startTime !== b.startTime) return compareTextDesc(a.startTime, b.startTime);
    return compareText(a.title, b.title);
  });

  return {
    name: normalizedName,
    meetings: meetingRows.length,
    afterparties: afterpartyRows.length,
    totalMeetings: parseInt(meetingTotalRows[0]?.count ?? "0", 10),
    totalAfterparties: parseInt(afterpartyTotalRows[0]?.count ?? "0", 10),
    items,
  };
}
