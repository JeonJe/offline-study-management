# DB Backups

Supabase Postgres의 정기 백업 보관 디렉토리.

## 백업 실행

```bash
npm run db:backup            # 스키마 + 데이터 전체
npm run db:backup -- --no-data  # 스키마만
```

출력:
- `saturday-meetup-YYYYMMDD-HHmmss.sql` — pg_dump 평문 SQL
- `saturday-meetup-YYYYMMDD-HHmmss.counts.json` — 테이블별 row count + 메타

## 의존성

- Node.js (프로젝트 기본)
- `pg_dump` 17.x — Homebrew: `brew install postgresql@17`
  - 자동 탐색 경로: `pg_dump`(PATH) → `/opt/homebrew/opt/postgresql@17/bin/pg_dump` → `/opt/homebrew/opt/postgresql@16/bin/pg_dump`
  - 다른 위치 사용 시: `PG_DUMP_BIN=/path/to/pg_dump npm run db:backup`

## 환경 변수

`.env.local`의 `DATABASE_URL` 사용 (Supabase pooler URL).

## 복원

```bash
# 1. 새 DB 생성 (예: 로컬 또는 별도 Supabase 프로젝트)
createdb saturday_meetup_restore

# 2. 복원
psql -d "$RESTORE_DATABASE_URL" -f backups/saturday-meetup-20260501-120000.sql

# 3. 검증 — 백업 시점 counts.json과 비교
node -e "console.table(require('./backups/saturday-meetup-20260501-120000.counts.json').rowCounts)"
```

## 정기 백업 가이드

### 수동 (권장 — 사이드 프로젝트 규모)

작업 시작 전 + 주 1회 권장.

### cron (선택)

```cron
# 매일 오전 9시
0 9 * * * cd ~/IdeaProjects/saturday-meetup && /opt/homebrew/bin/npm run db:backup >> backups/cron.log 2>&1
```

### 보존 정책

- 권장: 최근 7개 + 매주 1회 보관 + 매월 1회 보관
- 자동 정리 스크립트는 후속 백로그 항목으로 분리 (수동 정리 우선)

## 보안

- `backups/*.sql`은 운영 데이터 포함 — git 추적 금지 (`.gitignore` 처리됨)
- 외부 공유 시 PII 컬럼(이름, 전화번호 등) 마스킹 후 전송
- 클라우드 동기화 폴더(iCloud, Dropbox)에 보관 시 암호화 옵션 확인

## 관련 산출물

- 자율 워크플로우 위치 결정: `~/command-center/context/saturday-meetup/workflow-location-analysis.md`
- 백업 스크립트: `scripts/backup-db.mjs`
