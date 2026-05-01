# LFP-2 운영 단위 선택 진입 화면 계획

## 범위

- 첫 로그인 화면에서 활성 운영 단위(기수/커리큘럼)를 먼저 선택하게 한다.
- 선택한 운영 단위 상태를 `?unit=` query로 유지한다.
- 로그인 실패 시 선택한 운영 단위를 유지한 채 오류를 표시한다.
- DB 목록 로드 실패 시 기본 운영 단위(`3기`)로 fallback 한다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/meetup-dashboard.tsx` | 비인증 첫 화면에 운영 단위 선택 UI 추가 |
| `src/app/actions.ts` | 로그인 실패 시 선택한 운영 단위 query 유지 |

## 테스트

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx next build --webpack`
- 로컬 HTML 문구 확인

## 위험

- 이번 PR은 선택 UX만 추가한다. 인증은 아직 앱 공용 비밀번호를 사용한다.
- 기수별 비밀번호 hash 저장/검증은 LFP-4에서 별도 DB 변경으로 처리한다.
