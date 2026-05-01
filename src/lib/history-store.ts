import { query } from "@/lib/db";
import { DEFAULT_OPERATING_UNIT_SLUG } from "@/lib/operating-unit-store";
import { ensureSchema } from "@/lib/meetup-store";
import { ensureAfterpartySchema } from "@/lib/afterparty-store";

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

/**
 * 기간별 팀 출석률을 집계한다.
 *
 * - meetings 테이블에서 meeting_date BETWEEN start AND end 로 기간 필터
 * - member_teams + member_team_members JOIN으로 팀-멤버 매핑 확보
 * - rsvps LEFT JOIN으로 각 모임에 팀원 참석 여부 판정
 * - operatingUnitSlug 미전달 시 DEFAULT_OPERATING_UNIT_SLUG만 조회
 * - meetings가 0건이면 빈 배열 반환 (division by zero 방지)
 *
 * @param start 시작일 (ISO date string, 포함)
 * @param end 종료일 (ISO date string, 포함)
 * @param operatingUnitSlug 주소 식별자
 */
export async function getTeamAttendanceByPeriod(
  start: string,
  end: string,
  operatingUnitSlug: string = DEFAULT_OPERATING_UNIT_SLUG
): Promise<TeamAttendanceRow[]> {
  await ensureSchema();

  // 기간 내 전체 모임 수 확인
  const meetingRows = await query<{ id: string }>(
    `select id
     from public.meetings
     where meeting_date between $1 and $2
       and coalesce(operating_unit_slug, $3) = $3`,
    [start, end, operatingUnitSlug]
  );

  const totalMeetings = meetingRows.length;
  if (totalMeetings === 0) return [];

  const meetingIds = meetingRows.map((r) => r.id);

  // 팀별로 각 모임에 팀원이 1명이라도 참석했는지 집계
  // r.meeting_id 자체가 LEFT JOIN 매치 여부를 그대로 표현하므로 m_rsvp 서브쿼리는 불필요
  const rows = await query<{ team: string; attended: string }>(
    `select
       t.team_name as team,
       count(distinct r.meeting_id)::text as attended
     from public.member_teams t
     join public.member_team_members m on m.team_name = t.team_name
       and coalesce(m.operating_unit_slug, $2) = $2
     cross join unnest($1::uuid[]) as m_id
     left join public.rsvps r on r.meeting_id = m_id
       and lower(r.name) = lower(m.member_name)
     where coalesce(t.operating_unit_slug, $2) = $2
     group by t.team_name
     order by t.team_name`,
    [meetingIds, operatingUnitSlug]
  );

  return rows.map((r) => {
    const attended = parseInt(r.attended, 10);
    return {
      team: r.team,
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
 * - operatingUnitSlug 미전달 시 DEFAULT_OPERATING_UNIT_SLUG만 조회
 *
 * @param start 시작일 (ISO date string, 포함)
 * @param end 종료일 (ISO date string, 포함)
 * @param operatingUnitSlug 주소 식별자
 */
export async function getMemberAttendanceByPeriod(
  start: string,
  end: string,
  operatingUnitSlug: string = DEFAULT_OPERATING_UNIT_SLUG
): Promise<MemberAttendanceRow[]> {
  await ensureSchema();
  await ensureAfterpartySchema();

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
    [start, end, operatingUnitSlug]
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
    [start, end, operatingUnitSlug]
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

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
