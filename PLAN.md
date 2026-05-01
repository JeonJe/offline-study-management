# SM-7A 새 Supabase 프로젝트 + 스키마 적용 리허설

## 목표

- 새 Supabase 프로젝트에 `docs/db/01_init_schema.sql`을 재현 가능하게 적용한다.
- 운영 `.env.local`과 리허설 `.env.staging`을 분리한다.
- 테이블, 인덱스, RLS 상태를 적용 직후 검증한다.

## 범위

| 파일 | 변경 |
|------|------|
| `docs/migration/new-supabase-setup.md` | 새 프로젝트 생성부터 검증까지 리허설 절차 문서화 |
| `scripts/apply-schema.mjs` | `.env.staging` 기반 스키마 적용 + 검증 스크립트 추가 |

## 제외

- 실제 Supabase 프로젝트 생성은 계정 콘솔 권한이 필요하므로 문서 절차로 고정한다.
- 데이터 이관은 SM-7B에서 처리한다.
- 도메인/Vercel 환경변수 전환은 SM-7C에서 처리한다.

## 검증 계획

| 검증 | 명령 |
|------|------|
| 문법 검사 | `node --check scripts/apply-schema.mjs` |
| 도움말 확인 | `node scripts/apply-schema.mjs --help` |
| 기존 품질 게이트 | `npm run typecheck`, `npm run lint`, `npm test`, `npx next build --webpack` |
