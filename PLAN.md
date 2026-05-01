# LFP-3A 운영 단위 URL 호환 레이어 계획

## 목표
- `/angel`처럼 운영 단위가 드러나지 않는 직접 진입 문제를 줄인다.
- `/cohorts/{unit}/...` 주소를 먼저 지원하고, 기존 화면은 유지한다.
- 로그인 성공 시 선택한 기수의 cohort URL로 진입시킨다.

## 변경 파일
| 파일 | 변경 |
|------|------|
| `src/lib/cohort-routes.ts` | cohort URL 생성/rewrite 대상 계산 유틸 추가 |
| `src/lib/cohort-routes.test.ts` | URL 생성과 rewrite 매핑 회귀 테스트 |
| `src/proxy.ts` | `/cohorts/{unit}/...` 요청을 기존 route로 rewrite |
| `src/app/actions.ts` | 기수 로그인 성공 기본 이동을 `/cohorts/{unit}/loop-pak`으로 변경 |

## 비범위
- 데이터 조회/저장 스코프 분리는 아직 하지 않는다.
- 헤더 탭의 모든 링크를 cohort URL로 치환하는 작업은 다음 PR에서 처리한다.
- 운영 단위별 비밀번호/권한 분리는 LFP-4/LFP-5에서 처리한다.

## 검증
- `/cohorts/3%EA%B8%B0/loop-pak`이 `/loop-pak?unit=3%EA%B8%B0`로 rewrite되는지 확인
- `/cohorts/3%EA%B8%B0/angel`이 `/angel?unit=3%EA%B8%B0`로 rewrite되는지 확인
- `npm run typecheck`, `npm run lint`, `npm test`, `npx next build --webpack`
