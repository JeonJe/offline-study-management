# LFP-4A 운영 단위별 입장 코드 저장/검증

## 범위

| 파일 | 변경 |
|------|------|
| `docs/db/01_init_schema.sql` | `operating_units.access_password_hash` 컬럼 추가 |
| `src/lib/operating-unit-store.ts` | 기수별 입장 코드 hash 저장/검증 함수 추가 |
| `src/lib/auth.ts` | 전체 관리자 토큰과 기수 입장 토큰을 구분 |
| `src/app/actions.ts` | 기수 로그인은 선택한 운영 단위 기준으로 검증 |
| `src/lib/*.test.ts` | hash 저장, fallback, 쿠키 토큰 회귀 테스트 |

## 결정

- 입장 코드는 평문 저장하지 않고 `sha256(saturday-meetup:operating-unit:{slug}:{password})`로 저장한다.
- `access_password_hash`가 아직 없는 운영 단위는 기존 `APP_PASSWORD`를 fallback으로 허용해 배포 직후 잠김을 막는다.
- 전체 관리자 로그인은 기존 `APP_PASSWORD` 기반 쿠키를 유지하고, 기수 로그인은 `unit:{slug}:{token}` 형식 쿠키를 사용한다.

## 검증 계획

| 검증 | 기준 |
|------|------|
| 단위 테스트 | auth + operating-unit-store 신규/회귀 케이스 통과 |
| 타입체크 | `npm run typecheck` 통과 |
| Lint | `npm run lint` 통과 |
| 전체 테스트 | `npm test` 통과 |
| 빌드 | `npx next build --webpack` 통과 |

## 위험

- 이번 PR은 변경 UI까지 포함하지 않는다. 관리자 화면에서 기수별 코드를 변경하는 폼은 LFP-4B로 분리한다.
- 기존 페이지 대부분은 아직 `isAuthenticated()`를 전역으로 호출하므로, URL별 강한 권한 격리는 LFP-5에서 별도 적용한다.
