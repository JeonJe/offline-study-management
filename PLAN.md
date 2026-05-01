# LFP-1 LOOPERS MEETUP 표면 UX 정리 계획

## 범위

- 로그인 첫 화면 문구를 루퍼스 톤으로 담백하게 정리한다.
- 첫 화면에서 전체 관리자 진입점을 노출하되 기존 인증 보호는 유지한다.
- 일반 대시보드 헤더에 현재 기수 배지를 표시한다.
- 헤더 탭 라벨을 `루프팩`, `스터디`, `뒷풀이` 흐름에 맞춘다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/meetup-dashboard.tsx` | 로그인 첫 화면 문구, 입력 라벨, 버튼, 전체 관리자 링크 변경 |
| `src/app/dashboard-header.tsx` | 스터디 탭 라벨 복구, 현재 기수 배지 추가 |
| `src/app/page.tsx` | 스터디 화면 타이틀 복구 |
| `src/app/layout.tsx` | 브라우저 메타데이터를 루퍼스 문구로 변경 |

## 테스트

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx next build --webpack`
- 로컬 HTML 문구 확인

## 위험

- 전체 관리자 링크는 노출만 추가한다. 실제 접근 권한은 기존 `/admin` 인증 흐름을 그대로 따른다.
- 운영 단위 선택, 기수별 비밀번호, `/cohorts/{slug}` 라우팅은 후속 LFP-2~LFP-5에서 처리한다.
