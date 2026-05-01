# LFP-5C 전체 관리자 기수 관리 노출

## 범위

| 파일 | 변경 |
|------|------|
| `src/app/admin/page.tsx` | 전체 관리자 허브 전용 파일로 고정 |
| `src/app/cohorts/[unit]/admin/page.tsx` | 기수 관리자 허브 전용 파일 추가 |
| `src/proxy.ts` | `/cohorts/{unit}/admin`은 rewrite하지 않고 전용 파일로 라우팅 |
| `src/app/admin/operating-units/page.tsx` | 기수 생성 CTA와 입장 코드 상태 표시 추가 |
| `src/app/admin/operating-units/new/page.tsx` | feature flag 차단 제거, 전체 관리자 헤더 고정 |
| `src/app/admin/operating-units/[id]/edit/page.tsx` | feature flag 차단 제거, 전체 관리자 헤더 고정 |

## 결정

- 전체 관리자 페이지와 기수 관리자 페이지는 같은 파일에서 권한 분기하지 않는다.
- 전체 관리자 페이지에서 기수 관리는 핵심 기능이므로 feature flag에 묶지 않는다.
- 삭제는 데이터 손실 위험이 있어 하드 삭제 대신 기존 비활성화 흐름을 사용한다.
- 기수별 입장 코드 변경은 기존 편집 화면의 전용 form을 유지한다.

## 검증 계획

| 검증 | 기준 |
|------|------|
| 타입체크 | `npm run typecheck` 통과 |
| Lint | `npm run lint` 통과 |
| 전체 테스트 | `npm test` 통과 |
| 빌드 | `npx next build --webpack` 통과 |
