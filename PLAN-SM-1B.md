# SM-1B 관리자 운영 단위 생성/편집 form 계획

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/lib/operating-unit-store.ts` | slug 정책을 ASCII/숫자/`_`/`-`로 제한하고 `getOperatingUnit`, `updateOperatingUnit` 추가 |
| `src/lib/operating-unit-store.test.ts` | slug 정규화, get/update 쿼리, create/update 동작 검증 |
| `src/app/admin/operating-units/operating-unit-actions.ts` | admin role 비밀번호 검증 후 create/update server action 추가 |
| `src/app/admin/operating-units/new/page.tsx` | 신규 운영 단위 생성 form |
| `src/app/admin/operating-units/[id]/edit/page.tsx` | 기존 운영 단위 로드 후 편집 form |

## 테스트 시나리오

- 한글/공백 slug가 허용되지 않고 ASCII slug로 정규화된다.
- `getOperatingUnit(slug)`가 단일 row를 조회한다.
- `updateOperatingUnit()`가 기본 운영 단위 slug 변경 없이 name/description만 갱신한다.
- server action은 admin role 비밀번호가 틀리면 저장하지 않고 redirect한다.

## 위험 요소

- 보안: form mutation은 기존 로그인 + admin role password 검증을 둘 다 요구한다.
- 데이터: `is_default`는 form에서 수정하지 않는다. 기본값 보호는 SM-1C에서 다룬다.
- UX: 목록 페이지 진입 링크 추가는 파일 수 제한 때문에 이번 PR에서 제외한다.

## 리뷰 축

- QA: 생성/편집 경로와 실패 redirect 확인.
- 코드: 기존 auth/role-session/store 패턴 재사용.
- 테스트: store/action 단위 테스트로 mutation 조건 고정.
- 보안: admin password gate, open redirect 방지, raw HTML 없음.
