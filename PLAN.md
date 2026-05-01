# LFP-5B 관리자 스코프 분리

## 범위

| 파일 | 변경 |
|------|------|
| `src/lib/auth.ts` | 특정 기수 토큰만 허용하는 `isAuthenticatedForUnit` 추가 |
| `src/app/admin/page.tsx` | `/admin` 전체 관리자 허브와 `/cohorts/{slug}/admin` 기수 관리자 허브 분리 |
| `src/app/role-shell.tsx` | 전역 관리자 헤더 라벨/역할 nav 표시 제어 |
| `src/lib/auth.test.ts` | 기수 토큰 slug 매칭 테스트 추가 |

## 결정

- `/admin`은 전체 관리자 코드로 들어와 기수 관리만 보여준다.
- `/cohorts/{slug}/admin`은 해당 기수 토큰 또는 전체 관리자 토큰으로 들어와 기수 내부 관리 카드만 보여준다.
- `ADMIN_PAGE_PASSWORD`로 role을 얻는 흐름은 유지한다.

## 검증 계획

| 검증 | 기준 |
|------|------|
| 단위 테스트 | auth slug 매칭 테스트 통과 |
| 타입체크 | `npm run typecheck` 통과 |
| Lint | `npm run lint` 통과 |
| 전체 테스트 | `npm test` 통과 |
| 빌드 | `npx next build --webpack` 통과 |

## 후속

- admin 하위 보고/히스토리 화면의 데이터 store를 `unitSlug` 인자로 완전 분리한다.
