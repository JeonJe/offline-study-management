# 도메인/DB 이전 런북

이 문서는 SM-7B 데이터 이관 절차와 실패 시 롤백 기준을 고정한다. 새 Supabase 프로젝트 스키마 적용은 SM-7A, Vercel 환경변수와 도메인 전환은 SM-7C에서 진행한다.

## 1. 사전 조건

| 항목 | 확인 |
|------|------|
| 운영 백업 | `npm run db:backup`으로 `.sql`과 `.counts.json` 생성 |
| 새 DB 스키마 | `node scripts/apply-schema.mjs --env-file .env.prod` 성공 |
| 대상 DB env | `.env.prod`에 새 DB `DATABASE_URL`만 저장 |
| 운영 env 보존 | 기존 `.env.local`과 Vercel 운영 `DATABASE_URL`은 아직 변경하지 않음 |

## 2. 데이터 이관

최신 운영 백업을 새 DB에 import한다.

```bash
node scripts/migrate-data.mjs \
  --target-env-file .env.prod \
  --backup-sql backups/saturday-meetup-YYYYMMDD-HHmmss.sql \
  --source-counts backups/saturday-meetup-YYYYMMDD-HHmmss.counts.json
```

스크립트는 백업 SQL 전체를 그대로 복원하지 않는다. Supabase 내부 스키마와 현재 앱 스키마에 없는 과거 테이블 충돌을 피하기 위해 `docs/db/01_init_schema.sql`에 선언된 `public` 테이블의 `COPY` 블록만 추출한다.

| 단계 | 내용 |
|------|------|
| 1 | 백업 SQL에서 `COPY public.* FROM stdin` 블록 추출 |
| 2 | canonical schema에 없는 public table은 skip |
| 3 | target DB의 앱 테이블을 `TRUNCATE ... CASCADE` |
| 4 | FK 의존 순서대로 COPY 데이터 import |
| 5 | source `.counts.json`과 target row count 비교 |

성공 기준은 imported table 전체 `diff=0`이다. skip된 테이블은 보고서에 남긴다.

## 3. dry-run

DB 연결 없이 import 대상과 skip 대상을 먼저 확인한다.

```bash
node scripts/migrate-data.mjs \
  --backup-sql backups/saturday-meetup-YYYYMMDD-HHmmss.sql \
  --source-counts backups/saturday-meetup-YYYYMMDD-HHmmss.counts.json \
  --dry-run
```

## 4. 주요 화면 점검

이관 후 SM-7C 전환 전 새 DB를 연결한 preview 환경에서 다음 화면을 확인한다.

| 화면 | 확인 |
|------|------|
| 관리자 `/admin` | 모임/뒷풀이/멤버 카드 진입 가능 |
| 모임 `/` / `/meetings/[id]` | 목록, 상세, RSVP 수가 운영 백업과 일치 |
| 뒷풀이 `/afterparty` / `/afterparty/[id]` | 참가자와 정산 상태 표시 |
| 엔젤 `/angel` | 주간보고 사이클과 팀 목록 표시 |
| 멤버 `/members` | 팀/멤버/엔젤 목록 표시 |
| 히스토리 `/admin/history` | 팀/멤버 통계 row가 비어 있지 않음 |

## 5. 롤백

| 상황 | 조치 |
|------|------|
| import 실패 | 새 DB를 버리고 SM-7A 스키마 적용부터 다시 수행 |
| count mismatch | Vercel env 전환 금지, mismatch table 확인 후 새 백업으로 재시도 |
| preview 화면 회귀 | Vercel 운영 env 변경 금지, 원인 PR 수정 후 재이관 |
| 운영 전환 후 장애 | Vercel `DATABASE_URL`을 이전 값으로 되돌리고 redeploy, 새 DB는 읽기 전용 분석 대상으로 보존 |

운영 DB는 SM-7C 완료 전까지 계속 원본이다. cutover 전 단계에서 원본 DB에 쓰기 작업을 하지 않는다.

## 6. 도메인과 Vercel 환경변수 전환

별도 custom domain이 준비되지 않았으면 cutover 기준 주소는 `https://offline-study-management.vercel.app`로 둔다. custom domain을 붙이는 경우에도 구 Vercel production URL은 롤백용으로 유지한다.

| 환경변수 | 값 | 비고 |
|----------|----|------|
| `DATABASE_URL` | 새 Supabase project connection string | SM-7A/SM-7B 검증 완료 후에만 변경 |
| `NEXT_PUBLIC_BASE_URL` | 최종 공유 기준 URL | 공유 링크가 preview origin을 쓰지 않게 고정 |
| `APP_PASSWORD` | 기존 값 유지 | 운영자/멤버 접근 회귀 방지 |
| `OPERATING_UNIT_CODE_SECRET` | 기존 값 유지 | 기수별 코드 검증 회귀 방지 |

전환 순서:

1. Vercel Preview 또는 Staging 환경에 새 `DATABASE_URL`과 `NEXT_PUBLIC_BASE_URL`을 먼저 설정한다.
2. Preview에서 `node scripts/migrate-data.mjs --verify-only` 결과와 주요 화면 점검표를 확인한다.
3. Production 환경변수를 변경하고 redeploy한다.
4. Production에서 공유 링크 복사/카드 링크가 `NEXT_PUBLIC_BASE_URL` 기준으로 생성되는지 확인한다.

## 7. 공유 링크 검증

| 시나리오 | 기대값 |
|----------|--------|
| 모임 카드 링크 공유 | `/meetings/[id]`가 `NEXT_PUBLIC_BASE_URL` origin으로 생성 |
| 메인 공유 문구 복사 | `참여 링크:`가 최종 URL origin으로 생성 |
| preview 배포에서 공유 | preview host가 아니라 `NEXT_PUBLIC_BASE_URL` 사용 |
| invalid base URL | 런타임 `window.location.origin`으로 fallback |

단위 테스트:

```bash
npm test -- src/lib/share-url.test.ts
```

## 8. 사용자 공지문 초안

```text
토요모임 신청/공유 링크가 새 주소로 이전됐습니다.

새 주소: https://offline-study-management.vercel.app

기존 링크도 당분간 유지하지만, 새로 공유할 때는 위 주소를 사용해 주세요.
문제가 있으면 기존 링크로 접속한 뒤 운영자에게 알려 주세요.
```
