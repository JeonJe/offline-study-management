# SM-4A2 rsvps status 컬럼 + 대기 자동 분기 계획

## 변경 파일

| 파일 | 변경 |
|------|------|
| `docs/db/01_init_schema.sql` | `rsvps.status` 컬럼과 check 제약 추가 |
| `src/lib/meetup-store.ts` | 런타임 마이그레이션, RSVP 타입/status 조회, 정원 도달 시 waitlist 자동 배정 |
| `src/lib/meetup-store.test.ts` | schema/status/정원 분기 쿼리 검증 |

## 테스트 시나리오

- schema 보정 시 `status` 컬럼과 check 제약이 추가된다.
- 정원 없는 모임은 기존처럼 confirmed로 들어간다.
- 정원 있는 모임은 meeting row lock과 confirmed count 기반으로 waitlist를 계산한다.
- confirmed count는 summary에서만 집계되어 waitlist는 참여 인원에 섞이지 않는다.

## 위험 요소

- DB: 실제 migration 전 백업 완료 (`saturday-meetup-20260501-145553.sql`, counts 포함).
- 동시성: `for update`로 meeting row를 잠그고 같은 statement 안에서 confirmed count를 계산한다.
- UI: waitlist 표시/승격 UI는 SM-4A3 범위로 남긴다.

## 리뷰 축

- QA: 정원 없음/정원 도달/동시성 쿼리 조건 확인.
- 코드: 기존 bulk insert/upgrade CTE 구조 유지.
- 테스트: query shape와 반환 계약 검증.
- 보안: raw SQL identifier 추가 없음, 사용자 입력은 파라미터 바인딩 유지.
