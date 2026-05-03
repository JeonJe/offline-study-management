# Testing Map

테스트가 보호하는 영역과 실행 기준을 정리한다.

## 명령

| 명령 | 용도 |
| --- | --- |
| `npm run typecheck` | TypeScript 계약 검증 |
| `npm run lint` | ESLint 규칙 검증 |
| `npm test` | Vitest 단위/도메인 테스트 |
| `npm run build` | Next.js 서버 컴포넌트/import/runtime build 검증 |
| `npm run e2e` | Playwright chromium 사용자 흐름 |
| `npx playwright test --project=regression` | 쓰기 흐름 중심 회귀 시나리오 |
| `RUN_E2E=1 npm run quality:harness` | lint/test/build + 선택적 E2E 통합 게이트 |
| `npx playwright test e2e/performance.spec.ts --project=chromium` | 로컬 성능 기준선 측정, 결과는 `docs/performance-results.md`에 기록 |

## 단위 테스트 맵

| 테스트 | 보호 영역 |
| --- | --- |
| `src/lib/meetup-store.test.ts` | 모임 생성/수정/참여자/정원/대기 정책 |
| `src/lib/afterparty-store.test.ts` | 뒷풀이/참여자/정산 데이터 계약 |
| `src/lib/member-store.test.ts` | 멤버 프리셋 저장 데이터 |
| `src/lib/history-store.test.ts` | 참여 히스토리 집계와 캐시 key |
| `src/lib/operating-unit-store.test.ts` | 운영 단위 slug, access code, 활성화 정책 |
| `src/app/members/member-actions.test.ts` | 멤버 저장 Server Action payload 검증 |
| `src/app/weekly-report-actions.test.ts` | 주간 보고 댓글/권한 action |
| `src/lib/cache-invalidation.test.ts` | mutation 후 cache tag 무효화 |
| `src/lib/cohort-routes.test.ts` | cohort URL rewrite/aware path |
| `src/lib/sort-utils.test.ts` | locale 기반 정렬 유틸 |
| `src/lib/meeting-participants.test.ts` | 모임 상세 참여자 이름 정규화, 역할/팀 정렬, 빠른 추가 후보 정렬 |

## 커버리지 결정

2026-05-03 기준 정량 커버리지 리포트는 도입하지 않는다.

- 현재 `vitest.config.ts`는 coverage provider를 설정하지 않는다.
- Vitest 커버리지를 활성화하려면 일반적으로 `@vitest/coverage-v8` 같은 추가 dev dependency가 필요하다.
- 이 레포의 현재 운영 원칙은 새 의존성을 명시 승인 없이 추가하지 않는 것이다.
- 따라서 단기 기준은 테스트맵과 필수 게이트(`typecheck`, `lint`, `test`, `build`, 필요 시 `e2e`)로 유지한다.
- 커버리지 도입이 필요해지면 별도 변경으로 dependency 추가, threshold 기준, CI/로컬 실행 시간을 함께 결정한다.

## E2E 맵

| 파일 | 보호 흐름 |
| --- | --- |
| `e2e/cache-consistency.spec.ts` | 생성/수정/삭제 후 목록 즉시 반영, 멤버 프리셋 정합성 |
| `e2e/regression-meeting-flow.spec.ts` | 모임 생성, 참석, 취소, 재등록, 대기 승격 |
| `e2e/regression-afterparty-flow.spec.ts` | 뒷풀이 생성, 참여자 추가, 정산 토글, 삭제 |
| `e2e/regression-history-dashboard.spec.ts` | 히스토리 기간 변경, 팀/멤버 탭 이동 |
| `e2e/performance.spec.ts` | 주요 화면 TTFB와 mutation 후 응답 시간 |

## E2E 설정

공통 테스트 URL과 날짜는 `e2e/support/test-config.ts`에서 관리한다.

| 값 | 기본 |
| --- | --- |
| `TEST_OPERATING_UNIT_SLUG` | `loop-pak-3` |
| `CACHE_TEST_DATE` | `2026-03-01` |
| `REGRESSION_TEST_DATE` | `2026-09-01` |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` |

운영 유사 URL에서 E2E를 실행해야 하는 특별한 경우에는 명시적으로 `PLAYWRIGHT_BASE_URL`을 지정하고, 쓰기 시나리오가 실제 운영 데이터를 오염시키지 않는지 별도 확인한다.
