# 문서 안내

이 폴더는 LOOPERS MEETUP을 인계받은 사람이 제품을 이해하고, 운영하고, 필요하면 개발 변경까지 이어갈 수 있도록 정리한 문서 모음입니다.

처음 보는 사람은 아래 순서대로 읽으면 됩니다.

## 1. 비개발자/운영자 먼저 읽기

| 문서 | 목적 |
| --- | --- |
| `handoff-guide.md` | 제품이 무엇을 관리하는지, 사용자 권한과 전체 흐름을 이해합니다. |
| `user-guide.md` | 실제 화면 순서대로 기수 생성, 입장, 모임, 뒷풀이, 엔젤 보고, 관리자 기능을 따라 합니다. |
| `current-product-state.md` | 현재 가능한 기능과 운영 시 주의점을 확인합니다. |
| `operations-setup-guide.md` | 운영 URL, DB, Vercel 환경 변수, 관리자 코드 인계 절차를 확인합니다. |

## 2. 개발자/유지보수 담당자 읽기

| 문서 | 목적 |
| --- | --- |
| `development-guide.md` | 로컬 실행, 환경 변수, 검증 명령, 변경 전 체크리스트를 확인합니다. |
| `architecture.md` | 코드 구조, 인증/권한, 데이터 경계, 캐시 무효화 기준을 확인합니다. |
| `testing-map.md` | 어떤 테스트가 어떤 흐름을 보호하는지 확인합니다. |
| `ui-ux-principles.md` | 화면을 수정할 때 지켜야 할 UX 기준을 확인합니다. |

## 3. DB/배포/장애 대응 시 읽기

| 문서/폴더 | 목적 |
| --- | --- |
| `db/01_init_schema.sql` | 새 DB를 만들 때 적용하는 기준 스키마입니다. |
| `migration/new-supabase-setup.md` | 새 Supabase 프로젝트에 스키마를 적용하고 검증합니다. |
| `migration/cutover-runbook.md` | DB/도메인 전환과 롤백 기준을 따릅니다. |
| `../backups/README.md` | 운영 DB 백업과 복원 방법을 확인합니다. |

## 4. QA와 스크린샷

| 문서/폴더 | 목적 |
| --- | --- |
| `qa/feature-flag-matrix.md` | 현재 feature flag 상태와 신규 flag 추가 기준을 확인합니다. |
| `qa/mobile-checklist.md` | 모바일 화면과 접근성 점검 기준을 확인합니다. |
| `readme-screenshot-guide.md` | 인계용 스크린샷 갱신 방법을 확인합니다. |
| `screenshots/handoff/` | `user-guide.md`에서 사용하는 가데이터 기반 화면 이미지입니다. |

## 문서 유지 원칙

- 실제 비밀번호, DB URL, 관리자 코드, 실명/계좌 정보는 문서나 스크린샷에 남기지 않습니다.
- 운영 절차가 바뀌면 `operations-setup-guide.md`를 먼저 갱신합니다.
- 화면 흐름이 바뀌면 `user-guide.md`와 `screenshots/handoff/`를 함께 갱신합니다.
- DB 스키마가 바뀌면 `db/01_init_schema.sql`과 `migration/*` 문서를 함께 확인합니다.
- 테스트 명령이나 테스트 파일이 바뀌면 `testing-map.md`를 갱신합니다.
