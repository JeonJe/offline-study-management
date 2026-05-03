# Architecture Guide

Saturday Meetup은 Next.js App Router 서버 컴포넌트와 `pg` 기반 store 계층으로 구성된 내부 운영 대시보드다.

## 디렉터리 책임

| 경로 | 책임 |
| --- | --- |
| `src/app` | 라우트, 서버 액션, 화면 조립, route-local UI |
| `src/lib` | DB 접근, 도메인 계산, 캐시, 인증/권한, URL 유틸 |
| `e2e` | Playwright 사용자 흐름 회귀 테스트 |
| `scripts` | DB 백업/스키마 적용/품질 하네스 같은 운영 스크립트 |
| `docs/db` | 신규 DB 생성 기준 SQL |
| `docs/qa` | 수동/시각 QA 체크리스트 |

## 요청 흐름

1. 사용자는 `/`에서 운영 단위를 선택하고 입장 코드를 입력한다.
2. `/cohorts/{unit}/{section}` 주소는 `src/proxy.ts`와 `src/lib/cohort-routes.ts`를 통해 기존 화면으로 전달된다.
3. 화면은 `searchParams.unit`을 읽고 store/cache 계층에 운영 단위 경계를 넘긴다.
4. Server Action은 mutation 후 `src/lib/cache-invalidation.ts`의 tag/path 무효화를 호출한다.
5. 화면은 같은 cohort URL로 redirect되어 사용자가 선택한 운영 단위를 유지한다.

## 주요 진입점

| 업무 | 화면/액션 | 데이터 계층 |
| --- | --- | --- |
| 모임 목록/생성/참여자 | `src/app/meetup-dashboard.tsx`, `src/app/actions.ts` | `src/lib/meetup-store.ts` |
| 뒷풀이/정산 | `src/app/afterparty/**`, `src/app/actions.ts` | `src/lib/afterparty-store.ts` |
| 멤버/팀 편집 | `src/app/members/**` | `src/lib/member-store.ts` |
| 엔젤 주간 보고 | `src/app/angel/reports/**` | `src/lib/weekly-report-store.ts` |
| 참여 히스토리 | `src/app/admin/history/**` | `src/lib/history-store.ts` |
| 운영 단위 | `src/app/admin/operating-units/**` | `src/lib/operating-unit-store.ts` |

## 데이터 경계

운영 단위는 핵심 데이터 경계다. 새 코드는 암묵적인 기본 운영 단위에 의존하지 말고 URL, form hidden input, 또는 명시적인 함수 인자로 `operatingUnitSlug`를 전달해야 한다.

`loop-pak-3`는 기존 3기 데이터의 마이그레이션 slug로만 취급한다. 새 운영 단위가 추가될 수 있으므로 cache key, 조회 조건, 생성 payload에 운영 단위가 빠지면 캐시 오염이나 데이터 오염이 발생할 수 있다.

## 캐시와 무효화

읽기 캐시는 `src/lib/cached-queries.ts`에 모여 있고, mutation 후 무효화는 `src/lib/cache-invalidation.ts`를 통해 수행한다.

| 데이터 | 주요 tag |
| --- | --- |
| 모임/참여자 | `meetup-data`, `attendance` |
| 뒷풀이/정산 | `afterparty-data`, `attendance` |
| 멤버/팀 | `member-data`, `attendance` |
| 주간 보고 | 보고 store별 조회 경로 |

캐시를 추가할 때는 key에 운영 단위와 필터 값을 포함하고, mutation 후 영향을 받는 tag가 실제 사용자 화면을 갱신하는지 테스트해야 한다.

