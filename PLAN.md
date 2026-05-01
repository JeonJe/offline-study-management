# LFP-4B 기수별 입장 코드 관리자 UI

## 범위

| 파일 | 변경 |
|------|------|
| `src/app/admin/operating-units/operating-unit-actions.ts` | 입장 코드 변경 server action 추가 |
| `src/app/admin/operating-units/[id]/edit/page.tsx` | 기수 편집 화면에 입장 코드 변경 form 추가 |
| `src/lib/operating-unit-store.test.ts` | 관리자 비밀번호 검증 및 hash 저장 action 테스트 추가 |

## 결정

- 기수 이름/활성 상태 편집과 입장 코드 변경은 별도 form/server action으로 분리한다.
- 입장 코드 변경은 전체 관리자 role + 관리자 비밀번호 재입력 후에만 실행한다.
- 새 입장 코드는 `setOperatingUnitAccessCode`를 통해 hash로만 저장한다.

## 검증 계획

| 검증 | 기준 |
|------|------|
| 단위 테스트 | `operating-unit-store.test.ts` action 테스트 통과 |
| 타입체크 | `npm run typecheck` 통과 |
| Lint | `npm run lint` 통과 |
| 전체 테스트 | `npm test` 통과 |
| 빌드 | `npx next build --webpack` 통과 |

## 비범위

- 운영 단위별 강한 페이지 권한 경계는 LFP-5에서 처리한다.
