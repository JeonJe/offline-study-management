# LFP-5A 전체 관리자 인증 경계 고정

## 범위

| 파일 | 변경 |
|------|------|
| `src/lib/auth.ts` | 전체 관리자 전용 인증 함수 추가 |
| `src/app/admin/**` | 관리자 페이지/액션이 전역 관리자 토큰만 허용하도록 변경 |
| `src/app/api/db/ping/route.ts` | DB 점검 API도 전역 관리자 토큰만 허용 |
| `src/lib/auth.test.ts` | 기수 토큰이 전체 관리자 인증으로 통과하지 않는 회귀 테스트 추가 |
| `src/lib/operating-unit-store.test.ts` | auth mock을 전체 관리자 인증 함수에 맞춤 |

## 결정

- `isAuthenticated()`는 기존 사용자 화면 호환을 위해 기수 토큰을 계속 허용한다.
- `/admin` 계열과 DB 점검 API는 `isGlobalAuthenticated()`만 사용한다.
- LFP-5B에서 사용자 화면별 `unitSlug` 매칭을 강화한다.

## 검증 계획

| 검증 | 기준 |
|------|------|
| 단위 테스트 | auth + operating-unit-store 회귀 테스트 통과 |
| 타입체크 | `npm run typecheck` 통과 |
| Lint | `npm run lint` 통과 |
| 전체 테스트 | `npm test` 통과 |
| 빌드 | `npx next build --webpack` 통과 |

## 비범위

- 일반 사용자 화면의 기수별 토큰 매칭 강제는 LFP-5B에서 처리한다.
