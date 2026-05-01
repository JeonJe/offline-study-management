# LFP-3C 상세 화면 cohort returnPath 유지 계획

## 목표
- cohort URL로 상세 화면에 들어온 뒤 뒤로가기, 검색, 필터, form returnPath가 전역 URL로 빠지지 않게 한다.
- 모임/뒷풀이 상세와 엔젤 팀 보고 상세의 주요 이동 경로를 cohort-aware로 맞춘다.
- 전역 URL 진입은 기존 동작을 유지한다.

## 변경 파일
| 파일 | 변경 |
|------|------|
| `src/lib/cohort-routes.ts` | `/meetings/{id}` cohort 변환/rewrite 지원 추가 |
| `src/lib/cohort-routes.test.ts` | 모임 상세 URL 변환 테스트 추가 |
| `src/app/meetup-dashboard.tsx` | 모임 카드 상세 링크를 cohort-aware로 변경 |
| `src/app/meetings/[meetingId]/page.tsx` | 모임 상세 back/action/pathname/returnPath를 cohort-aware로 변경 |
| `src/app/afterparty/[afterpartyId]/page.tsx` | 뒷풀이 상세 back/action/pathname/returnPath를 cohort-aware로 변경 |
| `src/app/angel/reports/[cycleId]/teams/[teamName]/page.tsx` | 엔젤 팀 보고 목록 링크와 returnPath를 cohort-aware로 변경 |

## 비범위
- 데이터 스코프와 권한 경계는 LFP-4/LFP-5에서 처리한다.
- 관리자 하위 상세 화면의 모든 링크는 별도 권한 정리 단계에서 처리한다.

## 검증
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx next build --webpack`
- 인증 curl로 `/cohorts/3%EA%B8%B0/study` 모임 상세 링크와 상세 화면 action/back href 확인
- 인증 curl로 `/cohorts/3%EA%B8%B0/afterparty` 뒷풀이 상세 링크와 상세 화면 action/back href 확인
