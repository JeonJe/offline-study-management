# SM-7B 데이터 이관 스크립트 + 카운트 비교

## 목표

- `scripts/backup-db.mjs`가 만든 plain SQL 백업에서 앱 canonical `public` 테이블 데이터만 새 DB로 이관한다.
- import 직후 source counts와 target counts를 비교해 차이 0을 검증한다.
- cutover 전 주요 화면 점검과 롤백 절차를 문서화한다.

## 범위

| 파일 | 변경 |
|------|------|
| `scripts/migrate-data.mjs` | 백업 SQL의 `COPY public.*` 블록 추출, FK 순서 import, row count 비교 |
| `docs/migration/cutover-runbook.md` | 데이터 이관, 화면 점검, 롤백 절차 문서화 |
| `PLAN.md` | SM-7B 구현 계획으로 갱신 |

## 제외

- 실제 새 Supabase 프로젝트 connection string 확보와 스키마 적용은 SM-7A 범위다.
- Vercel 환경변수 전환과 도메인 공유 링크 검증은 SM-7C 범위다.
- Supabase 내부 `auth`, `storage`, `realtime` 스키마 import는 앱 데이터 이관 범위에서 제외한다.

## 검증 계획

| 검증 | 명령 |
|------|------|
| 문법 검사 | `node --check scripts/migrate-data.mjs` |
| dry-run | `node scripts/migrate-data.mjs --backup-sql <backup.sql> --source-counts <counts.json> --dry-run` |
| 기존 품질 게이트 | `npm run typecheck`, `npm run lint`, `npm test`, `npx next build --webpack` |
