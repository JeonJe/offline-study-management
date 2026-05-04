# Saturday Meetup 운영 이전 README

이 문서는 외부 개발자가 새 Supabase DB와 새 운영 도메인으로 Saturday Meetup을 바로 오픈할 때 필요한 단일 절차서입니다.

신규 오픈 기준이므로 Vercel Preview/Staging 검증은 선택으로 두고, 기본 절차는 Production 직접 전환입니다. 단, Production 환경변수를 바꾸기 전에 새 DB 스키마 적용과 데이터 이관 검증은 끝내야 합니다.

## 1. 전달받아야 하는 것

문서와 코드:

| 항목 | 목적 | 필수 |
| --- | --- | --- |
| [`docs/migration/README.md`](./README.md) | 이 절차서 | 예 |
| [`docs/db/01_init_schema.sql`](../db/01_init_schema.sql) | 새 DB 기준 스키마 | 예 |
| [`scripts/apply-schema.mjs`](../../scripts/apply-schema.mjs) | 새 Supabase에 스키마 적용/검증 | 예 |
| [`scripts/migrate-data.mjs`](../../scripts/migrate-data.mjs) | 백업 SQL을 새 Supabase로 이관 | 예 |
| [`scripts/lib/env-utils.mjs`](../../scripts/lib/env-utils.mjs) | env 파일 로드 공통 유틸 | 예 |
| [`package.json`](../../package.json) | Node 스크립트/의존성 정의 | 예 |
| [`package-lock.json`](../../package-lock.json) | 고정된 Node 의존성 버전 | 예 |
| [`docs/operations-setup-guide.md`](../operations-setup-guide.md) | 운영 env와 권한 코드 배경 설명 | 참고 |
| [`docs/handoff-guide.md`](../handoff-guide.md) | 제품/권한/화면 흐름 요약 | 참고 |
| [`docs/user-guide.md`](../user-guide.md) | 오픈 직후 수동 점검용 화면 가이드 | 참고 |
| [`backups/README.md`](../../backups/README.md) | 백업 생성/복원 참고 | 참고 |

운영 데이터 파일:

| 항목 | 예시 | 전달 방식 |
| --- | --- | --- |
| 백업 SQL | `backups/saturday-meetup-YYYYMMDD-HHmmss.sql` | 별도 안전 채널 |
| 백업 row count | `backups/saturday-meetup-YYYYMMDD-HHmmss.counts.json` | 별도 안전 채널 |

백업 SQL과 counts 파일은 반드시 같은 timestamp 쌍이어야 합니다.

새 운영 환경에서 설정할 값:

| 환경변수 | 어디에 설정하나 | 용도 | 예시/주의 |
| --- | --- | --- | --- |
| `DATABASE_URL` | `.env.prod`, Vercel Production | 새 Supabase/Postgres 연결 | 평문 노출 금지 |
| `NEXT_PUBLIC_BASE_URL` | Vercel Production | 공유 링크 기준 origin | `https://example.com` |
| `APP_PASSWORD` | Vercel Production | 전체관리자 `/admin` 진입 | 새로 사용할 값 설정 |
| `OPERATING_UNIT_CODE_SECRET` | Vercel Production | 기수별 입장/엔젤/관리자 코드를 안전하게 저장할 때 쓰는 서버 비밀값 | 랜덤 문자열 새로 설정, 운영 중 변경 금지 |

`OPERATING_UNIT_CODE_SECRET`은 사용자가 입력하는 입장 코드가 아닙니다. DB에 저장되는 기수별 코드를 보호하기 위한 서버 내부 비밀값입니다.

## 2. 로컬 준비

```bash
npm install
```

새 Supabase 연결 문자열은 레포 루트의 `.env.prod`에만 저장합니다. 이 파일은 커밋하지 않습니다.

`.env.production`은 Next.js production build에서 읽는 표준 파일명이므로, 마이그레이션 전용 파일은 `.env.prod`처럼 명시적으로 분리합니다.

```dotenv
DATABASE_URL=postgresql://...
```

셸 환경변수와 `.env.prod`가 동시에 있으면 스크립트는 `.env.prod` 값을 우선 사용합니다.

## 3. 새 Supabase 스키마 적용

```bash
node scripts/apply-schema.mjs --env-file .env.prod
```

적용 후 검증만 다시 실행할 수 있습니다.

```bash
node scripts/apply-schema.mjs --env-file .env.prod --verify-only
```

성공 기준:

| 검증 | 기대값 |
| --- | --- |
| tables | `docs/db/01_init_schema.sql`의 public table이 모두 존재 |
| indexes | SQL 파일의 index가 모두 존재 |
| RLS | 현재 앱 기준으로 앱 테이블 RLS가 켜져 있지 않음 |

## 4. 데이터 이관

먼저 dry-run으로 import 대상과 skip 대상을 확인합니다.

```bash
node scripts/migrate-data.mjs \
  --backup-sql backups/saturday-meetup-YYYYMMDD-HHmmss.sql \
  --source-counts backups/saturday-meetup-YYYYMMDD-HHmmss.counts.json \
  --dry-run
```

문제가 없으면 새 Supabase DB에 데이터를 import합니다.

```bash
node scripts/migrate-data.mjs \
  --target-env-file .env.prod \
  --backup-sql backups/saturday-meetup-YYYYMMDD-HHmmss.sql \
  --source-counts backups/saturday-meetup-YYYYMMDD-HHmmss.counts.json
```

스크립트는 백업 SQL 전체를 그대로 복원하지 않고, `docs/db/01_init_schema.sql`에 선언된 앱용 `public` 테이블의 `COPY` 데이터만 추출합니다. Supabase 내부 스키마나 과거 테이블 충돌을 피하기 위한 동작입니다.

성공 기준:

| 항목 | 기준 |
| --- | --- |
| import | 에러 없이 종료 |
| row count | imported table 전체 `diff=0` |
| skipped table | 앱 canonical schema에 없는 테이블만 skip |

`count mismatch`가 있으면 Production 전환을 멈추고 백업 파일, schema, skip 목록을 확인합니다.

## 5. Vercel Production 환경변수 교체

신규 오픈이라 Preview 없이 바로 Production으로 갈 수 있습니다. 그래도 순서는 아래처럼 유지합니다.

1. 기존 Production 환경변수 값을 별도 운영 노트에 백업합니다.
2. Vercel Production `DATABASE_URL`을 새 Supabase 연결 문자열로 설정합니다.
3. Vercel Production `NEXT_PUBLIC_BASE_URL`을 최종 운영 URL로 설정합니다.
4. 아래 코드/비밀값 환경변수를 설정합니다.
5. Production redeploy를 실행합니다.

Production 환경변수:

| 변수 | 값 |
| --- | --- |
| `DATABASE_URL` | 새 Supabase connection string |
| `NEXT_PUBLIC_BASE_URL` | 최종 운영 URL |
| `APP_PASSWORD` | 전체관리자 코드 |
| `OPERATING_UNIT_CODE_SECRET` | 기수별 코드 보호용 비밀값 |

## 6. 오픈 직후 점검

Production redeploy 후 최종 운영 URL에서 확인합니다.

| 화면 | 확인 |
| --- | --- |
| `/` | 첫 화면이 열리고 기수 선택 가능 |
| `/admin` | 전체관리자 코드로 진입 가능 |
| `/admin/operating-units` | 기수 목록/상세 접근 가능 |
| `/cohorts/{기수}/entry` | 기수 입장 코드로 입장 가능 |
| `/cohorts/{기수}/study` | 스터디 목록 표시 |
| `/cohorts/{기수}/afterparty` | 뒷풀이 목록 표시 |
| `/cohorts/{기수}/angel` | 엔젤 코드로 접근 가능 |
| `/cohorts/{기수}/admin` | 관리자 코드로 접근 가능 |
| 공유 문구 복사 | 링크 origin이 `NEXT_PUBLIC_BASE_URL`과 일치 |

공유 링크 단위 테스트:

```bash
npm test -- src/lib/share-url.test.ts
```

## 7. 롤백 기준

신규 오픈이어도 아래 상황이면 전환을 멈추거나 되돌립니다.

| 상황 | 조치 |
| --- | --- |
| 스키마 적용 실패 | 새 Supabase 프로젝트를 비우거나 다시 만들고 3단계부터 재시도 |
| 데이터 import 실패 | 새 DB를 비우고 백업 파일 확인 후 4단계 재시도 |
| row count mismatch | Production 전환 금지 |
| Production 오픈 후 접속 불가 | Vercel `DATABASE_URL`을 이전 값으로 되돌리고 redeploy |
| 공유 링크가 다른 origin으로 생성 | `NEXT_PUBLIC_BASE_URL` 확인 후 redeploy |

## 8. 절대 하지 말 것

- 실제 `DATABASE_URL`, 관리자 코드, 토큰을 문서나 PR에 남기지 않습니다.
- 운영 백업 `.sql`을 공개 저장소나 공개 채팅에 올리지 않습니다.
- `OPERATING_UNIT_CODE_SECRET`은 운영 중 임의로 바꾸지 않습니다.
- row count 검증 전 Production `DATABASE_URL`을 바꾸지 않습니다.
- 운영 데이터가 들어간 DB에서 임의 쓰기 테스트를 하지 않습니다.

## 9. 작업 완료 기록 템플릿

아래 내용만 운영 노트에 남깁니다. 비밀번호와 전체 connection string은 남기지 않습니다.

```text
오픈 일시:
최종 운영 URL:
Supabase project ref/host 일부:
백업 파일:
스키마 적용: success / fail
데이터 이관: success / fail
row count diff: 0 / mismatch
Vercel redeploy URL:
오픈 직후 점검 결과:
롤백 필요 여부:
```
