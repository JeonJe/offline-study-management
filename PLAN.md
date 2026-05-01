# LFP-5E 목록 관리 문구와 기본 주소 정리

## 범위

| 파일 | 변경 |
|------|------|
| `src/lib/operating-unit-store.ts` | 기본 주소를 `loop-pak-3`로 변경하고 기존 `3기` 데이터 이관 |
| `src/lib/member-store.ts` | 멤버 관리 테이블 기본 주소를 `loop-pak-3` 상수로 통일 |
| `src/app/admin/operating-units/*` | `기수` 표현 제거, 활성/비활성 제어와 중복 확인 코드 제거 |
| `src/app/admin/page.tsx` | 전체 관리자 카드 문구를 목록 관리 중심으로 변경 |
| `src/app/cohorts/[unit]/admin/page.tsx` | 관리자 헤더에서 `기수` 표현 제거 |
| `src/app/meetup-dashboard.tsx` | 첫 화면 선택 문구를 이름 중심으로 변경 |
| `src/lib/*test.ts` | 기본 주소 변경과 중복 확인 코드 제거에 맞춰 회귀 테스트 갱신 |

## 결정

- URL에 한글 `3기`가 노출되지 않도록 기본 주소는 `loop-pak-3`로 사용한다.
- 기존 `3기` 주소와 데이터는 런타임 스키마 보정에서 `loop-pak-3`로 이관한다.
- 전체 관리자 인증 이후 편집 form에서 확인 코드를 다시 받지 않는다.
- 활성/비활성은 현재 운영 화면에서 노출하지 않고 이름, 주소, 입장 코드만 관리한다.
- 사용자 화면 문구는 `기수` 대신 `이름`, `목록`, `항목`을 사용한다.

## 검증 계획

| 검증 | 기준 |
|------|------|
| 타입체크 | `npm run typecheck` 통과 |
| Lint | `npm run lint` 통과 |
| 전체 테스트 | `npm test` 통과 |
| 빌드 | `npx next build --webpack` 통과 |
