# SM-7C 새 도메인 연결 + 환경변수 + 공유 링크 검증

## 목표

- 새 도메인 또는 Vercel production URL을 cutover 기준 주소로 고정한다.
- 공유 링크 생성이 preview origin이 아니라 `NEXT_PUBLIC_BASE_URL`을 우선 사용하게 한다.
- Vercel 환경변수 전환과 구 도메인 롤백 절차를 런북에 남긴다.

## 범위

| 파일 | 변경 |
|------|------|
| `src/lib/share-url.ts` | 공유 URL origin 결정에 `NEXT_PUBLIC_BASE_URL` 반영 |
| `src/app/offline-study-copy-text-button.tsx` | 공유 문구 복사 링크도 동일 origin 규칙 사용 |
| `src/lib/share-url.test.ts` | 새 base URL/invalid fallback 회귀 테스트 |
| `.env.example` | cutover 관련 env 예시 보강 |
| `docs/migration/cutover-runbook.md` | Vercel env, 도메인, 공유 링크, 공지문 절차 추가 |

## 제외

- 실제 Vercel 환경변수 변경과 도메인 연결은 계정 권한이 필요한 운영 액션이다.
- 새 Supabase 스키마 적용과 데이터 import는 SM-7A/SM-7B에서 완료된 절차를 따른다.

## 검증 계획

| 검증 | 명령 |
|------|------|
| 공유 링크 단위 테스트 | `npm test -- src/lib/share-url.test.ts` |
| 기존 품질 게이트 | `npm run typecheck`, `npm run lint`, `npm test`, `npx next build --webpack` |
