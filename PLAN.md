# LFP-3B cohort 링크 유지 계획

## 목표
- `/cohorts/{unit}/...`로 진입한 뒤 상단 탭과 주요 카드 링크가 전역 URL로 빠지지 않게 한다.
- 역할 비밀번호 입력 실패/성공 후에도 cohort URL을 유지한다.
- 기존 전역 URL 진입은 그대로 동작하게 둔다.

## 변경 파일
| 파일 | 변경 |
|------|------|
| `src/lib/cohort-routes.ts` | 기존 href를 cohort URL로 변환하는 `cohortAwarePath` 추가 |
| `src/lib/cohort-routes.test.ts` | query/hash/rest path 보존 테스트 추가 |
| `src/app/dashboard-header.tsx` | 상단 탭 링크를 unit-aware URL로 생성 |
| `src/app/meetup-dashboard.tsx` | 날짜 선택/공유/생성 returnPath에 cohort base path 적용 |
| `src/app/afterparty/page.tsx` | 뒷풀이 날짜/상세 링크에 cohort URL 적용 |
| `src/app/role-shell.tsx`, `src/app/member/page.tsx`, `src/app/members/page.tsx`, `src/app/angel/page.tsx`, `src/app/admin/page.tsx` | 역할/관리 화면의 주요 링크에 unit context 전달 |
| `src/app/role-actions.ts`, `src/app/role-page-view.tsx` | 역할 비밀번호 입력 후 returnPath 유지 |

## 비범위
- 상세 페이지 내부의 모든 폼 returnPath 전환은 후속으로 처리한다.
- 데이터 조회/저장 스코프와 비밀번호 권한 경계는 LFP-4/LFP-5에서 처리한다.

## 검증
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx next build --webpack`
- 인증 쿠키를 사용해 `/cohorts/3%EA%B8%B0/loop-pak`, `/cohorts/3%EA%B8%B0/afterparty` 렌더의 주요 href가 cohort URL로 유지되는지 확인
