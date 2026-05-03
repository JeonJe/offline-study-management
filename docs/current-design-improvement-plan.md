# Saturday Meetup 현재 디자인 개선 계획

작성일: 2026-05-02

## 1. 기준과 전제

이 문서는 현재 레포의 실제 소스 기준으로 디자인 개선 방향을 정리한다. `docs/screenshots/*sample.png`는 과거 샘플이므로 판단 기준에서 제외했다.

2026-05-03 기준으로 로컬 Playwright 검증 경로는 확보됐다. 헤더/역할 페이지 정리는 localhost에서 좌표와 링크를 확인했으며, 남은 큰 디자인 단계는 별도 phase로 진행한다.

이번 계획의 기준은 다음 파일을 직접 확인한 결과다.

- `src/app/globals.css`
- `src/app/dashboard-header.tsx`
- `src/app/role-shell.tsx`
- `src/app/meetup-dashboard.tsx`
- `src/app/afterparty/page.tsx`
- `src/app/afterparty/[afterpartyId]/page.tsx`
- `src/app/meetings/[meetingId]/page.tsx`
- `src/app/members/member-admin-form.tsx`

## 2. 디자인 목표

Saturday Meetup은 마케팅 사이트가 아니라 현장 운영 대시보드다. 디자인 목표는 "예쁜 화면"보다 운영자가 빠르게 확인하고 입력하고 복구할 수 있는 UI다.

목표 상태:

- 밝고 정돈된 productivity dashboard 톤
- 핵심 액션 위치 일관화
- 카드/섹션 중첩 감소
- 모바일에서 헤더, 탭, 폼, 액션 버튼 겹침 제거
- 모임/뒷풀이/정산/멤버/보고 화면의 패턴 통일
- 외부 개발사가 새 화면을 추가할 때 따라 할 수 있는 컴포넌트 규칙 제공

Refero 레퍼런스는 **Amie의 밝은 생산성 툴 톤**을 1순위로 둔다. 단, Amie의 랜딩 레이아웃을 가져오는 것이 아니라 버튼 위치, 툴바, 패널, 카드 밀도 같은 운영 도구 패턴만 참고한다. Plain의 절제된 정보 밀도도 보조 기준으로 삼는다.

## 3. 현재 디자인 진단

### 3.1 토큰과 표면

현재 `globals.css`는 흰색/연회색/파란 accent를 이미 갖고 있어 Amie 계열로 이동하기 쉽다.

문제는 표면 계층이 많고 시각 효과가 다소 누적된다는 점이다.

- `body`에 옅은 파란 gradient가 있음
- `.card`, `.card-static`, `.app-section`, `.list-surface`, `.panel-surface`, `.section-toolbar`가 각각 border, radius, shadow를 따로 가짐
- `rounded-2xl`, `shadow-sm`, `shadow-lg`, `shadow-2xl`가 화면 곳곳에서 직접 사용됨
- 카드 안에 카드, 패널 안에 패널이 반복되는 구조가 많음

개선 방향:

- 배경 gradient를 줄이고 거의 흰색/아주 옅은 회색 canvas로 정리
- shadow는 modal/drawer에만 남기고 일반 카드에는 hairline border 중심 적용
- radius는 운영 도구 기준으로 8~12px를 기본값으로 낮춤
- `.card-static`과 `.app-section`의 차이를 명확히 하거나 하나로 통합

### 3.2 헤더와 내비게이션

`DashboardHeader`가 기수 단위 fixed top header, tab nav, logout button을 담당한다. `RoleShell`은 같은 헤더를 재사용한다.

현재 장점:

- 상단 고정 내비게이션이 있어 화면 전환은 빠름
- 운영 단위 표시가 헤더에 있음
- 모바일에서 탭을 horizontal scroll로 처리함

현재 문제:

- 헤더 높이는 `DashboardHeader` spacer로 보정하지만, fixed header라 향후 탭/액션이 늘면 다시 높이 검증이 필요함
- 로그아웃이 모든 화면에서 같은 시각 우선순위로 노출되어 primary 업무 액션보다 눈에 띌 수 있음
- 현재 헤더 탭은 `루프팩 / 스터디 / 뒷풀이 / 엔젤 / 관리자` 5개 세트로 정리됐지만, Amie식 productivity toolbar와 비교하면 상단 액션 위계는 아직 약함

개선 방향:

- `DashboardHeader`를 `TopNavigation` 패턴으로 더 정리
- 페이지 타이틀, 운영 단위, 탭, 보조 액션, 위험 액션을 slot으로 분리
- 로그아웃은 danger button이 아니라 작은 secondary danger 또는 menu action으로 낮춤
- 모바일 spacer는 고정 height 대신 header layout token 또는 sticky 상단 block으로 정리

2026-05-03 반영 완료:

- `RoleShell`은 `DashboardHeader`를 재사용한다.
- `멤버` 탭은 중복 허브라 제거했다.
- 기존 `/cohorts/{unit}/member` 접근은 `/cohorts/{unit}/study`로 리다이렉트한다.
- 헤더 버튼과 로그아웃 버튼의 높이/패딩을 늘렸다.
- 모바일/데스크톱에서 헤더와 첫 카드가 겹치지 않음을 Playwright 좌표로 확인했다.

### 3.3 생성 액션

스터디/루프팩과 뒷풀이 목록은 `details.fixed bottom-6 right-6` 형태의 FAB로 생성 폼을 연다.

현재 문제:

- 운영 도구에서는 FAB가 "무엇을 생성하는지" 즉시 드러나지 않는다.
- 오른쪽 하단 도움말/브라우저 UI/모바일 키보드와 충돌 가능성이 있다.
- 날짜 필터와 생성 액션이 분리되어 있어 "이 날짜에 생성"이라는 맥락이 약하다.
- `details` 기반 floating form은 접근성/닫힘/포커스 관리가 모달이나 drawer보다 약하다.

개선 방향:

- 대시보드/뒷풀이 목록 상단 toolbar 오른쪽에 `모임 만들기`, `뒷풀이 만들기` primary button 배치
- 생성 form은 inline expanded panel 또는 right drawer로 전환
- 모바일에서는 toolbar 아래 full-width primary button 또는 bottom action bar 사용
- FAB는 제거하거나 보조 빠른 액션으로 격하

### 3.4 목록 대시보드

`MeetupDashboard`와 `AfterpartyPage`는 날짜 toolbar, 요약, stat strip, 카드 목록을 가진다.

현재 문제:

- 스터디와 뒷풀이가 비슷한 구조지만 `app-section`과 `card-static`, toolbar 배치가 다르게 구현됨
- `STAT_CONFIG` 색상에 직접 hex가 섞여 있음
- 요약/목록/공유 액션의 순서가 화면마다 다름
- 카드 hover에 translate/shadow가 있어 업무용 dense list보다 마케팅 카드 느낌이 섞임

개선 방향:

- 공통 `DashboardToolbar`: 날짜, 검색/필터, count, primary action
- 공통 `MetricStrip`: 모임 수, 총 참여, 멤버, 운영진, 정산 완료율
- 공통 `DenseCardList`: 카드 grid/list 전환 가능
- hover는 translate보다 border/accent만 사용
- 카드 안 액션 위치 통일: 제목/메타 왼쪽, 상태/카운트 오른쪽, 상세 링크는 전체 card hit area

### 3.5 상세 화면과 사이드 패널

`meetings/[meetingId]/page.tsx`와 `afterparty/[afterpartyId]/page.tsx`는 이미 `lg:sticky`, `aside`, `participant-quick-add` 같은 2-column 패턴을 일부 사용한다.

현재 장점:

- 상세 본문과 빠른 참여자 추가 패널을 나누려는 방향이 있음
- 뒷풀이 상세는 참여자/정산 흐름을 한 화면에서 처리 가능

현재 문제:

- 본문 카드, 정산 선택, 참여자 관리, quick add aside가 각자 다른 surface 규칙을 사용함
- 참여자 목록과 정산 상태가 섞여 있어 처음 보는 개발자/운영자가 어디를 조작해야 하는지 파악이 늦을 수 있음
- `rounded-2xl`, `shadow-sm`, nested border가 반복됨
- 수정 관리 버튼이 상단에 있으나 생성/삭제/정산 같은 액션 계층이 한 화면에서 분산됨

개선 방향:

- 상세 화면 기본 레이아웃: `DetailShell = main column + action panel`
- 모임 상세 action panel: 공유, 수정 관리, 참여자 빠른 추가, 팀 assignment
- 뒷풀이 상세 action panel: 정산 선택, 정산 요약, 참여자 빠른 추가
- 참여자 목록과 정산 토글은 같은 row pattern으로 통일
- 위험 액션은 drawer/modal 내부 하단 danger zone으로 이동

### 3.6 멤버 관리 화면

`member-admin-form.tsx`는 팀, 멤버, 엔젤, 운영진 역할을 한 form 상태에서 관리한다.

현재 장점:

- `MemberSaveToolbar`가 있어 저장 상태를 명확히 만들려는 구조가 있음
- 팀별 카드와 운영진 역할 카드가 분리되어 있음

현재 문제:

- 팀 영역과 운영진 영역의 순서가 `order-1`, `order-2`로 조절되어 실제 읽기 흐름을 코드에서 추론해야 함
- 팀 카드마다 멤버 chip, 버튼, 삭제 action이 많아 시각 밀도가 높음
- 운영진 역할 카드와 팀 카드가 비슷한 card surface를 쓰지만 액션 위치가 다름

개선 방향:

- `MemberAdminShell`: 좌측 팀 목록/우측 편집 패널 또는 상단 summary + section panels
- 저장 toolbar는 sticky bottom 또는 section header right에 고정
- 팀 카드 action: `팀 수정`, `팀 삭제` 위치 통일
- 운영진 역할은 tab/segmented control + list로 단순화

### 3.7 엔젤/관리자 화면

`RoleShell`, `admin/reports`, `angel/reports`, `admin/history`는 `card-static` 중심으로 구성된다.

현재 문제:

- 보고/히스토리/운영 단위 관리가 같은 card language를 쓰지만 정보 위계가 다름
- 관리자 화면은 table/list 성격인데 카드형으로 흩어지기 쉬움
- 보고 작성/댓글/제출 상태는 activity panel 패턴이 더 적합함

개선 방향:

- 관리자: filter toolbar + table/list + detail panel
- 엔젤 보고: report editor + activity/comment side panel
- 제출 상태: chip보다 compact status column으로 정리
- 새 보고 주차/템플릿 생성은 toolbar primary action으로 이동

## 4. 적용할 디자인 패턴

### 4.1 공통 패턴

| 패턴 | 목적 | 적용 화면 |
| --- | --- | --- |
| `TopNavigation` | 헤더/탭/운영 단위/로그아웃 통일 | 전체 |
| `PageToolbar` | 날짜/필터/count/primary action 정렬 | 스터디, 루프팩, 뒷풀이, 관리자 |
| `MetricStrip` | 요약 수치 표시 통일 | 대시보드, 뒷풀이, 히스토리 |
| `ActionPanel` | 상세 화면 우측 작업 영역 | 모임 상세, 뒷풀이 상세, 보고 상세 |
| `DenseCard` | 운영 카드의 compact list/card | 모임, 뒷풀이 |
| `StatusChip` | 역할/상태 chip 통일 | 전체 |
| `DangerZone` | 삭제/위험 액션 격리 | 상세/관리 modal |
| `InlineFeedback` | 저장/오류/중복/권한 메시지 통일 | form 전체 |

### 4.2 가져올 Refero 스타일 요소

Amie에서 가져올 것:

- 밝은 canvas와 얇은 구분선
- 한 가지 primary blue
- toolbar 중심의 작업 배치
- 과하지 않은 카드와 compact type scale
- 부드러운 hover보다 명확한 active/focus state

Plain에서 가져올 것:

- 낮은 장식성
- 정보 밀도 높은 list/table
- 명확한 form label과 helper text

가져오지 않을 것:

- 랜딩 hero
- 큰 마케팅 섹션
- 장식 이미지
- 과한 여백
- 업무 흐름을 느리게 하는 full-page modal 남용

## 5. 실행 순서

### Phase 0. 현재 화면 캡처 기준선 확보

목표: 실제 현재 화면을 캡처하고 이후 디자인 변경의 비교 기준으로 남긴다.

작업:

- `npm run typecheck`
- `npm run build`
- 권한이 허용되는 브라우저 검증 경로로 현재 화면 캡처

캡처 대상:

- `/cohorts/loop-pak-3/study?date=2026-03-01`
- `/cohorts/loop-pak-3/afterparty?date=2026-03-01`
- `/cohorts/loop-pak-3/members`
- `/cohorts/loop-pak-3/admin/history`
- `/cohorts/loop-pak-3/angel/reports`
- 모임 상세 1개
- 뒷풀이 상세 1개

### Phase 1. 토큰 정리

목표: 전체 인상이 바뀌지만 기능/레이아웃은 그대로 유지한다.

작업:

- `--bg`를 더 중립적인 light canvas로 조정
- body gradient 약화 또는 제거
- `--line`, `--surface-alt`, `--accent-weak` 재정의
- 카드 shadow 축소
- radius 기본값 축소
- danger/success/role 색상 토큰 정리

검증:

- 시각 변경만 있어야 한다.
- `npm run typecheck`, `npm run lint`, `npm test`
- desktop/mobile 캡처 비교

### Phase 2. 헤더와 툴바 통일

목표: primary action과 화면 전환 위치를 일관화한다.

작업:

- `DashboardHeader`와 `RoleShell` 공통 구조 추출 완료
- 헤더 탭을 `루프팩/스터디/뒷풀이/엔젤/관리자` 5개 세트로 정리 완료
- `PageToolbar` 도입
- 날짜 선택, count, 생성 버튼을 toolbar에 배치
- 로그아웃 시각 우선순위 낮추기
- mobile spacer 1차 조정 완료, 장기적으로 layout token화

우선 적용:

- 스터디/루프팩 대시보드
- 뒷풀이 목록

검증:

- 모바일 390px에서 탭/버튼 겹침 없음
- 날짜 변경과 생성 버튼 위치가 일관됨
- 기존 form action 동작 유지

### Phase 3. FAB 제거와 생성 패턴 변경

목표: 생성 액션의 맥락과 접근성을 높인다.

작업:

- 스터디/루프팩 `+` FAB를 toolbar primary button으로 이동
- 뒷풀이 `+` FAB를 toolbar primary button으로 이동
- `details` floating form을 inline expandable panel 또는 drawer로 교체
- 모바일에서는 full-width action button 적용

검증:

- 모임 생성 E2E 또는 수동 확인
- 뒷풀이 생성 E2E 또는 수동 확인
- keyboard focus 흐름 확인

### Phase 4. 상세 화면 ActionPanel 정리

목표: 상세 화면에서 읽는 영역과 조작 영역을 분리한다.

작업:

- `DetailShell` 패턴 도입
- 모임 상세의 공유/수정/참여자 추가/팀 assignment를 action panel로 정리
- 뒷풀이 상세의 정산 선택/정산 요약/참여자 빠른 추가를 action panel로 정리
- 삭제 액션은 danger zone으로 이동

검증:

- 모임 참석자 추가/삭제/대기 승격
- 뒷풀이 참여자 추가/정산 토글/삭제
- desktop과 mobile에서 action panel이 자연스럽게 쌓이는지 확인

### Phase 5. 멤버/관리자/엔젤 화면 정리

목표: 복잡한 관리 화면을 list + editor 또는 toolbar + table 패턴으로 정리한다.

작업:

- 멤버 관리: sticky save toolbar, 팀 list, 운영진 role tabs
- 관리자 히스토리: filter toolbar + table/list density 개선
- 엔젤 보고: editor + comment/activity side panel
- 보고 관리자: cycle list + submission status table

검증:

- 멤버 저장 테스트
- 히스토리 기간 변경 테스트
- 주간 보고 제출/댓글 테스트

## 6. 검증 루프

각 phase는 아래 순서로만 완료 처리한다.

1. 변경 전 현재 화면 캡처
2. 작은 단위 구현
3. `npm run typecheck`
4. `npm run lint`
5. `npm test`
6. 해당 화면 수동 또는 Playwright 확인
7. desktop/mobile 캡처 비교
8. 개선 효과 판단

효과 판단 기준:

- 주요 액션 위치가 더 예측 가능해졌는가
- 카드/패널 중첩이 줄었는가
- 모바일에서 horizontal overflow나 겹침이 없는가
- 운영자가 생성/수정/정산/저장을 더 빨리 찾을 수 있는가
- 외부 개발자가 같은 패턴으로 새 화면을 만들 수 있는가

## 7. 리스크와 보류 항목

- 브라우저 캡처 권한이 확보되어야 실제 화면 기반 검증이 가능하다.
- 화면 구조 변경은 form action과 redirect 동작을 깨뜨릴 수 있으므로 phase별 테스트가 필요하다.
- drawer 도입은 접근성/포커스 관리 비용이 있으므로 기존 `details`보다 나아지는지 확인해야 한다.
- 공통 컴포넌트는 너무 일찍 만들면 오히려 추상화 비용이 커진다. 두 화면 이상에서 반복이 확인된 뒤 추출한다.
- 색상/토큰 변경은 운영자가 이미 익숙한 상태 색을 해치지 않는 선에서 진행한다.

## 8. 첫 작업 추천

첫 작업은 디자인 자체가 아니라 **현재 화면 캡처 가능 상태 복구 + 디자인 기준선 캡처**다.

그 다음 가장 안전한 순서는 다음이다.

1. `globals.css` token 정리
2. 스터디/뒷풀이 목록 toolbar 통일
3. FAB 제거
4. 상세 화면 action panel 정리
5. 멤버 관리/엔젤/관리자 화면 density 정리

이 순서가 안전한 이유는 먼저 시각 토큰과 상단 구조를 맞추면 이후 상세/관리 화면도 같은 규칙을 따라갈 수 있기 때문이다.
