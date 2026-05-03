# Development Guide

외부 개발자가 변경을 시작할 때 따르는 작업 절차다.

## 로컬 준비

```bash
npm install
cp .env.example .env.local
npm run db:ping
npm run dev
```

필수 환경 변수:

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 |
| `APP_PASSWORD` | 일반 입장 코드 및 전역 인증 |
| `ADMIN_PAGE_PASSWORD` | 관리자 역할 화면 |
| `ANGEL_PAGE_PASSWORD` | 엔젤 역할 화면 |
| `NEXT_PUBLIC_BASE_URL` | 공유/링크 생성 기준 URL |

## 변경 전 체크

```bash
git status --short
npm run typecheck
npm run lint
npm test
```

DB 스키마나 운영 데이터에 영향을 주는 변경 전에는 백업을 먼저 만든다.

```bash
npm run db:backup
```

## 변경 종류별 진입점

| 변경 | 먼저 볼 파일 | 같이 확인할 파일 |
| --- | --- | --- |
| 모임 필드 추가 | `src/lib/meetup-store.ts` | `src/app/actions.ts`, `src/app/meetup-dashboard.tsx`, `docs/db/01_init_schema.sql` |
| 뒷풀이 정산 변경 | `src/lib/afterparty-store.ts` | `src/app/afterparty/[afterpartyId]/page.tsx`, E2E afterparty spec |
| 멤버 저장 변경 | `src/app/members/member-actions.ts` | `src/lib/member-store.ts`, `src/app/members/member-admin-form.tsx` |
| 운영 단위 변경 | `src/lib/operating-unit-store.ts` | `src/lib/cohort-routes.ts`, `src/lib/cached-queries.ts` |
| 히스토리 성능 | `src/lib/history-store.ts` | `src/app/admin/history/**`, `e2e/performance.spec.ts` |

## 검증 게이트

작은 유틸/문서 변경:

```bash
npm run typecheck
npm run lint
npm test
```

서버 컴포넌트, route, Server Action 변경:

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

사용자 흐름 변경:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test --project=regression
```

`PLAYWRIGHT_BASE_URL`을 명시하지 않으면 Playwright는 localhost를 기본값으로 사용한다. 운영 유사 URL에서 쓰기 E2E를 실행하지 않는다.

## 커밋 전 체크리스트

- 변경 범위가 한 가지 목적에 묶여 있는가
- 운영 단위가 명시적으로 전달되는가
- 캐시 key와 invalidation tag가 변경 데이터 범위를 반영하는가
- DB 변경이면 `docs/db/01_init_schema.sql`과 store 보정 로직이 함께 갱신됐는가
- 테스트가 새 동작 또는 회귀 위험을 잠그는가

