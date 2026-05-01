# LOOPERS MEETUP

LOOPERS MEETUP은 루프팩, 스터디, 뒷풀이 운영을 한 곳에서 관리하는 내부 운영 대시보드입니다.

운영자는 항목별 입장 코드로 강의/기수별 공간에 들어가고, 멤버는 모임과 뒷풀이를 확인합니다. 엔젤과 관리자는 별도 비밀번호로 전용 화면에 접근해 주간 보고, 팀 배정, 히스토리, 운영 항목 관리를 수행합니다.

## 현재 제품 구조

| 영역 | 주요 경로 | 용도 |
|------|-----------|------|
| 첫 진입 | `/` | 항목 선택 드롭다운 + 입장 코드 입력 |
| 루프팩 | `/loop-pak`, `/cohorts/{항목}/loop-pak` | 정규 오프라인 수업 카드 관리 |
| 스터디 | `/`, `/cohorts/{항목}/study` | 스터디 모임 카드 관리 |
| 뒷풀이 | `/afterparty`, `/cohorts/{항목}/afterparty` | 뒷풀이 참석/정산 관리 |
| 멤버 | `/member`, `/cohorts/{항목}/member` | 멤버용 공용 진입 화면 |
| 엔젤 | `/angel`, `/cohorts/{항목}/angel` | 엔젤 주간 보고 작성 |
| 관리자 | `/cohorts/{항목}/admin` | 선택한 항목의 팀/보고/히스토리 관리 |
| 전체 관리자 | `/admin` | 항목 생성, 편집, 입장 코드 관리 |

`/cohorts/{항목}/{섹션}` 형태의 주소는 내부적으로 기존 화면으로 rewrite됩니다. 예를 들어 `/cohorts/loop-pak-3/afterparty`는 `loop-pak-3` 항목의 뒷풀이 화면으로 동작합니다.

## 핵심 기능

### 항목별 운영

- 전체 관리자가 운영 항목을 생성/수정합니다.
- 각 항목은 주소용 슬러그, 표시 이름, 설명, 입장 코드를 가집니다.
- 항목별 입장 코드는 일반 사용자 진입에 사용됩니다.
- 전용 입장 코드가 없는 항목은 공용 `APP_PASSWORD`로 입장합니다.

### 루프팩/스터디 관리

- 날짜별 오프라인 모임 카드 조회
- 모임 생성, 수정, 삭제
- 장소, 시간, 설명, 방장 정보 관리
- 참여자 단건 추가 및 여러 명 일괄 추가
- 멤버/엔젤/서포터/버디/멘토/매니저 역할 구분
- 팀 프리셋 기반 빠른 추가
- 공유용 텍스트 복사와 카드 이미지 캡처

### 뒷풀이/정산 관리

- 날짜별 뒷풀이 카드 조회
- 뒷풀이 생성, 수정, 삭제
- 참여자 추가/삭제
- 정산 묶음 생성
- 정산 담당자와 계좌 정보 관리
- 참여자별 정산 완료 상태 토글

### 멤버/팀 관리

- 팀 추가/삭제
- 팀별 멤버 목록 관리
- 팀별 엔젤 배정
- 고정 엔젤 디렉터리 관리
- 운영 역할 디렉터리 관리
- 저장 상태 표시

### 엔젤 주간 보고

- 엔젤 비밀번호로 전용 화면 접근
- 주차별 보고 목록 확인
- 담당 팀의 주간 보고 작성/수정
- 관리자 화면에서 제출 현황 확인

### 관리자 화면

- 기수/항목 관리자: 선택한 항목의 보고 주차, 멤버/팀/엔젤 배정, 히스토리 관리
- 전체 관리자: 항목 생성/편집, 항목별 입장 코드 관리
- 전체 관리자와 항목 관리자는 화면 파일과 진입 경로가 분리되어 있습니다.

## 권한과 비밀번호

| 구분 | 환경 변수/저장 위치 | 설명 |
|------|----------------------|------|
| 공용 입장 코드 | `APP_PASSWORD` | 기본 사용자 진입 코드 |
| 항목별 입장 코드 | DB 저장 | 전체 관리자 화면에서 생성/변경 |
| 전체 관리자 코드 | `APP_PASSWORD` 기반 전역 인증 | `/admin` 진입에 사용 |
| 엔젤 비밀번호 | `ANGEL_PAGE_PASSWORD` | 엔젤 전용 화면 접근 |
| 관리자 비밀번호 | `ADMIN_PAGE_PASSWORD` | 역할 관리자 화면 접근 |

엔젤/관리자 역할 접근은 `localStorage`가 아니라 `httpOnly` 쿠키로 저장됩니다. 쿠키는 12시간 유지되며, 관리자 권한은 엔젤 화면도 열 수 있지만 엔젤 권한으로 관리자 화면은 열 수 없습니다.

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- PostgreSQL (`pg`)
- Tailwind CSS
- Vitest
- Playwright
- Vercel 배포 기준

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

기본 개발 서버는 `http://localhost:3000`입니다.

`.env.local`에는 실제 값을 넣습니다.

```bash
DATABASE_URL=postgresql://...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
APP_PASSWORD=...
ADMIN_PAGE_PASSWORD=...
ANGEL_PAGE_PASSWORD=...
OPERATING_UNITS_ENABLED=true
PG_DUMP_BIN=/opt/homebrew/bin/pg_dump
PSQL_BIN=/opt/homebrew/bin/psql
```

## 데이터베이스 운영

스키마 적용/검증:

```bash
node scripts/apply-schema.mjs --env-file .env.local
node scripts/apply-schema.mjs --env-file .env.local --verify-only
```

DB 변경 전 백업:

```bash
npm run db:backup
```

백업 결과는 `backups/` 아래에 SQL 파일과 row count JSON으로 저장됩니다.

DB 연결 확인:

```bash
npm run db:ping
```

## 검증 명령

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

E2E:

```bash
npm run e2e
npm run e2e:ui
```

통합 품질 하네스:

```bash
npm run quality:harness
```

`RUN_E2E=1`을 주면 E2E까지 포함합니다.

## 스크린샷

샘플 스크린샷은 `docs/screenshots/`에 있습니다.

| 화면 | 파일 |
|------|------|
| 스터디 대시보드 | `docs/screenshots/study-dashboard-sample.png` |
| 스터디 상세 | `docs/screenshots/study-detail-sample.png` |
| 뒷풀이 대시보드 | `docs/screenshots/afterparty-dashboard-sample.png` |
| 뒷풀이 상세 | `docs/screenshots/afterparty-detail-sample.png` |
| 멤버 관리 | `docs/screenshots/members-sample.png` |

스크린샷 갱신:

```bash
npm run docs:screenshots
```

가이드: [`docs/readme-screenshot-guide.md`](docs/readme-screenshot-guide.md)

## 운영 원칙

- DB 변경 전에는 반드시 `npm run db:backup`을 실행합니다.
- 전체 관리자 화면과 항목 관리자 화면은 파일/경로를 분리해 권한 사고를 줄입니다.
- 역할 홈에는 해당 역할의 고유 작업만 노출합니다. 공용 모임/뒷풀이는 멤버 화면에서 관리합니다.
- PR 검증 기준은 typecheck, lint, test, build 통과입니다.
