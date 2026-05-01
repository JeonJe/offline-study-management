# SM-5C 히스토리 그래프 시각화 계획

## 목표
- `/admin/history` 표 위에 기간별 참여 흐름을 빠르게 볼 수 있는 차트 영역을 추가한다.
- 새 dependency 없이 단순 SVG/CSS 막대 차트로 번들 영향을 0에 가깝게 유지한다.

## 범위
- `src/app/admin/history/attendance-chart.tsx`: 팀/멤버 상위 참여 막대 차트.
- `src/app/admin/history/page.tsx`: 현재 탭에 맞는 차트 배치.

## 구현 순서
1. 팀 탭은 참여율 상위, 멤버 탭은 모임+뒷풀이 합계 상위로 차트 데이터를 만든다.
2. 데이터 0건 또는 값 0인 경우 깨지지 않는 빈 상태를 표시한다.
3. 새 라이브러리 없이 기존 CSS token과 server component만 사용한다.
4. 표 정렬/기간 query 동작은 변경하지 않는다.

## 검증
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx next build --webpack`
