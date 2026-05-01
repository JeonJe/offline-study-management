# LFP-2B 전체 관리자 모달 분리 계획

## 목표
- 첫 화면에서 기수 입장 코드 입력과 전체 관리자 코드 입력을 명확히 분리한다.
- 전체 관리자 진입은 별도 링크를 누르면 모달로 열리게 한다.
- 관리자 코드 실패 시 모달이 열린 상태로 에러 메시지를 보여준다.

## 변경 파일
| 파일 | 변경 |
|------|------|
| `src/app/meetup-dashboard.tsx` | 기존 `details` 관리자 폼을 CSS 기반 모달로 교체 |

## 검증
- 첫 화면에 기수 드롭다운 + 입장 코드만 기본 노출되는지 확인
- `전체 관리자` 클릭 시 관리자 코드 모달이 나타나는지 확인
- `?adminAuth=invalid` 진입 시 모달이 열린 상태로 에러가 보이는지 확인
- `npm run typecheck`, `npm run lint`, `npm test`, `npx next build --webpack`

## 위험
- 클라이언트 상태 없이 CSS `:target`과 서버 렌더 상태를 사용한다. URL hash는 서버에 전달되지 않으므로 실패 상태는 기존 `adminAuth=invalid` 쿼리로 처리한다.
