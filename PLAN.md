# SM-6B 모바일 뷰 + 접근성 점검 계획

## 목표
- 주요 7개 화면을 390x844 모바일 뷰포트에서 자동 캡처한다.
- 버튼/텍스트 겹침, 라벨, 키보드 포커스, 색 대비 점검 결과를 문서화한다.

## 범위
- `scripts/capture-mobile-screenshots.mjs`: Playwright 기반 모바일 캡처/간단 접근성 점검 스크립트.
- `docs/qa/mobile-checklist.md`: 실행 방법과 7개 화면 검증 결과 표.

## 구현 순서
1. 스크립트가 `.env`/`.env.local`을 로드하고 app/admin role 인증 쿠키를 생성한다.
2. `PLAYWRIGHT_BASE_URL` 또는 기본 production URL을 대상으로 390x844 캡처를 수행한다.
3. 7개 대상 경로를 순회하며 screenshot, focusable count, image alt 누락, label 없는 form control을 기록한다.
4. 스크립트 출력은 git 추적 제외 경로인 `test-results/mobile-screenshots`에 저장한다.
5. 문서에 체크리스트와 이번 실행 결과를 표로 남긴다.

## 검증
- `node scripts/capture-mobile-screenshots.mjs --base-url http://localhost:{port}`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx next build --webpack`
