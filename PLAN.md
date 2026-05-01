# SM-6C Feature flag 검증 매트릭스 계획

## 목표
- 현재 feature flag의 ON/OFF 기대 동작을 문서화한다.
- 신규 feature flag 추가 시 갱신해야 할 규칙과 교차 케이스를 남긴다.

## 범위
- `docs/qa/feature-flag-matrix.md`: 현재 flag 표, ON/OFF 매트릭스, 교차 케이스.
- 코드 변경은 기존 연결 상태를 확인한 뒤 필요할 때만 수행한다.

## 구현 순서
1. `feature-flags.ts`의 현재 flag를 확인한다.
2. `/admin` 카드와 `/admin/operating-units` 라우트 gate 연결 상태를 확인한다.
3. ON/OFF/교차 케이스를 문서 표로 정리한다.
4. 새 flag 추가 규칙을 문서에 남긴다.

## 검증
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx next build --webpack`
