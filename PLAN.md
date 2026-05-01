# LFP-5D 전체 관리자 기수 관리 문구 개선

## 범위

| 파일 | 변경 |
|------|------|
| `src/app/admin/operating-units/new/page.tsx` | 주소 식별자/기수 이름/전체 관리자 확인 코드 문구와 placeholder 개선 |
| `src/app/admin/operating-units/[id]/edit/page.tsx` | 편집/입장 코드 변경 form의 권한 확인 문구 개선 |
| `src/app/admin/operating-units/page.tsx` | 목록 헤더에서 슬러그 대신 주소 식별자 표시 |
| `src/app/admin/operating-units/operating-unit-actions.ts` | 생성 시 기수 입장 코드 필수화 |
| `src/app/dashboard-header.tsx` | 대시보드 공통 헤더 높이 축소 |
| `src/app/role-shell.tsx` | 관리자/역할 페이지 공통 헤더 높이 축소 |
| `src/lib/operating-unit-store.ts` | 생성 시 입장 코드 저장, `3기` URL 인코딩 정규화, 레거시 `default` 목록 숨김 |
| `src/lib/operating-unit-store.test.ts` | 생성 입장 코드/`3기` 정규화/레거시 숨김 회귀 테스트 |

## 결정

- 내부 용어인 `슬러그`를 사용자에게 그대로 노출하지 않는다.
- `관리자 비밀번호`는 무엇을 확인하는지 모호하므로 `전체 관리자 확인 코드`로 통일한다.
- 기수 입장 코드는 참가자가 첫 화면에서 입력하는 코드라는 설명을 붙인다.
- 기수 생성 시 입장 코드가 없으면 생성 후 바로 사용할 수 없으므로 생성 단계에서 필수 입력으로 받는다.
- `default`는 과거 데이터 이관용 내부 값이므로 관리자 목록에는 노출하지 않는다.
- sticky 헤더는 작업 화면의 세로 공간을 많이 차지하므로 padding, 타이틀 크기, 버튼 높이를 함께 줄인다.

## 검증 계획

| 검증 | 기준 |
|------|------|
| 타입체크 | `npm run typecheck` 통과 |
| Lint | `npm run lint` 통과 |
| 전체 테스트 | `npm test` 통과 |
| 빌드 | `npx next build --webpack` 통과 |
