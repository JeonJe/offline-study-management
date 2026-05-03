# 새 Supabase 프로젝트 스키마 리허설

SM-7A의 목적은 운영 DB를 건드리지 않고 새 Supabase 프로젝트에 현재 스키마를 재현하는 것이다. 데이터 이관은 SM-7B, 도메인과 Vercel 환경변수 전환은 SM-7C에서 한다.

## 1. 새 Supabase 프로젝트 생성

| 항목 | 값 |
|------|----|
| Region | 운영과 같은 `ap-northeast-1` 우선 |
| Database password | 운영 비밀번호와 다른 값 |
| Connection mode | Direct connection 또는 Session pooler |
| SSL | Supabase 기본 SSL 사용 |

프로젝트 생성 후 Supabase Dashboard의 `Project Settings > Database > Connection string`에서 새 DB 연결 문자열을 확보한다. 운영 `DATABASE_URL`을 덮어쓰지 않는다.

## 2. 리허설 환경 파일 분리

레포 루트에 `.env.staging`을 만들고 새 프로젝트 연결 문자열만 넣는다. 이 파일은 커밋하지 않는다.

```dotenv
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

`DATABASE_URL is not set` 또는 DNS 오류가 나면 `.env.staging`의 host/ref/password를 먼저 확인한다.

## 3. 스키마 적용

최신 스키마 파일은 `docs/db/01_init_schema.sql`이다. 새 프로젝트에 다음 명령으로 적용한다.

```bash
node scripts/apply-schema.mjs --env-file .env.staging
```

적용 후 다시 검증만 돌릴 때는 다음 명령을 쓴다.

```bash
node scripts/apply-schema.mjs --env-file .env.staging --verify-only
```

스크립트는 다음 순서로 동작한다.

| 단계 | 내용 |
|------|------|
| 1 | `.env.staging`에서 `DATABASE_URL` 로드. 셸에 남아 있는 같은 이름의 환경변수보다 env 파일 값이 우선 |
| 2 | `psql --set ON_ERROR_STOP=1`로 `docs/db/01_init_schema.sql` 적용 |
| 3 | SQL 파일에 선언된 `public` 테이블과 인덱스 목록 추출 |
| 4 | DB의 실제 테이블, 인덱스, RLS 활성화 상태 조회 |
| 5 | 누락 항목이 있으면 실패 종료 |

## 4. 검증 기준

| 검증 | 기대값 |
|------|--------|
| 테이블 | SQL 파일의 `create table if not exists public.*` 목록이 모두 존재 |
| 인덱스 | SQL 파일의 `create index if not exists *` 목록이 모두 존재 |
| RLS | 현재 스키마는 RLS를 활성화하지 않으므로 모든 앱 테이블 `DISABLED` |
| 운영 단위 | `operating_units`에 `loop-pak-3` row 존재, 앱 데이터 테이블의 `operating_unit_slug`에는 DB default 없음 |

RLS가 켜진 테이블이 있으면 스크립트가 경고로 출력한다. 현재 앱은 서버 측 `pg` 연결과 자체 역할 쿠키 검증에 기대므로, RLS 정책을 추가하려면 별도 PR에서 앱 쿼리 권한 모델까지 같이 설계한다.

## 5. 리허설 기록

명령 성공 후 PR description에 다음을 기록한다.

| 항목 | 예시 |
|------|------|
| 적용 대상 | Supabase project ref 또는 host 일부 마스킹 |
| 스키마 파일 | `docs/db/01_init_schema.sql` |
| 테이블 검증 | `tables=15 missing=0` |
| 인덱스 검증 | `indexes=27 missing=0` |
| RLS 검증 | `rlsEnabled=0` |

비밀번호, 전체 connection string, 프로젝트 토큰은 PR/로그/스크린샷에 남기지 않는다.

## 6. 다음 단계

| 후속 | 내용 |
|------|------|
| SM-7B | 운영 백업을 새 DB에 import하고 row count 차이 0 검증 |
| SM-7C | Vercel `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL` 전환과 공유 링크 검증 |
