# Requirements Analysis Packet

## 1) PRD Snapshot

- **Problem**: 부트캠프 3기 매주 토요일 오프라인 모임에 50명+ 인원이 참여하지만, 누가 오는지/어디서 하는지/어떤 엔젤이 참여하는지 파악이 안 됨
- **Target User**: 부트캠프 3기 교육생 + 엔젤(멘토)
- **Business Goal**: 한 페이지에서 모임 현황을 한눈에 파악 → 참여율 향상 + 운영 효율화
- **Success Metric**: 모든 참여자가 셀프 RSVP로 출석 등록하고, 관리자가 실시간 현황 확인 가능

## 2) Scope Definition

### In-Scope

- 주차별 모임 생성/관리 (날짜, 장소, 시간)
- 셀프 RSVP (교육생/엔젤 각각 참여 등록)
- 대시보드: 참여자 목록, 엔젤 목록, 장소, 인원 수 한눈에 표시
- 공용 비밀번호로 페이지 접근 제한
- 50명+ 대응 (검색/필터)
- Vercel 무료 배포 + Supabase 무료 DB

### Out-of-Scope

- 소셜 로그인 (카카오/구글)
- 채팅/커뮤니티 기능
- 결제/비용 정산
- 모바일 앱 (웹 반응형으로 대응)
- 알림 (카카오톡/이메일 등)

## 3) Requirement Matrix

| ID | Requirement | Type | Priority | Why it matters | Verification |
|----|-------------|------|----------|----------------|--------------|
| R1 | 주차별 모임 생성 (날짜, 장소, 시간, 설명) | F | MUST | 매주 다른 장소/시간일 수 있음 | 모임 생성 후 대시보드에 표시됨 |
| R2 | 셀프 RSVP - 이름 + 역할(교육생/엔젤) + 한마디 입력 | F | MUST | 핵심 기능. 관리 부담 제거 | 등록 후 참여자 목록에 즉시 반영 |
| R3 | 대시보드 - 참여 교육생/엔젤/장소/인원 한눈에 표시 | F | MUST | 핵심 UX. 한 페이지 파악 | 모든 정보가 스크롤 없이 또는 최소 스크롤로 보임 |
| R4 | 교육생 vs 엔젤 구분 표시 | F | MUST | 역할별 현황 파악 | 엔젤/교육생 각각 카운트 + 별도 섹션 |
| R5 | 공용 비밀번호 인증 | F | MUST | 외부 노출 방지 | 비밀번호 없이 접근 시 차단 |
| R6 | 참여 취소 기능 | F | SHOULD | 변경 가능해야 함 | 등록 후 취소 가능, 목록에서 제거 |
| R7 | 50명+ 참여자 목록 검색/필터 | F | SHOULD | 대규모 인원 관리 | 이름 검색 시 필터링됨 |
| R8 | 모바일 반응형 UI | NF | MUST | 교육생이 폰으로 접속할 가능성 높음 | 375px 이상에서 정상 표시 |
| R9 | Supabase 무료 티어 내 운영 | NF | MUST | 비용 0원 유지 | 500MB, 50K row 이내 |
| R10 | 과거 모임 히스토리 조회 | F | COULD | 출석 기록 추적 | 지난 주차 모임 데이터 열람 가능 |

## 4) Constraints

- **Technical**: Vercel 무료 (Serverless, 100GB bandwidth), Supabase 무료 (500MB, 50K rows), Next.js App Router
- **Policy/Compliance**: 개인정보 최소 수집 (이름만), 비밀번호는 환경변수로 관리
- **Timeline/Resource**: MVP 우선, 1인 개발

## 5) Gaps & Decisions (확정)

- [x] **모임 생성 권한**: 누구나 → 별도 관리자 페이지 불필요, 공용 비밀번호로 접근한 사람이면 모임 생성 가능
- [x] **RSVP 필드**: 이름 + 한마디 (예: "늦을 수 있어요")
- [x] **엔젤 수**: 여러 명 → RSVP 시 역할(교육생/엔젤) 선택 필요, 엔젤 참여 현황 별도 표시

## 6) Acceptance Criteria (Testable)

1. Given 비밀번호 미입력 → When 페이지 접근 → Then 비밀번호 입력 화면만 표시
2. Given 올바른 비밀번호 입력 → When 접근 → Then 대시보드(모임 목록) 표시
3. Given 로그인 상태 → When "모임 만들기" 클릭 → Then 날짜/시간/장소/설명 입력 후 생성
4. Given 모임 존재 → When 참여 버튼 클릭 → Then 이름 + 역할(교육생/엔젤) + 한마디 입력 후 목록에 즉시 반영
5. Given 참여 등록 완료 → When 대시보드 조회 → Then 교육생 N명/엔젤 N명/장소/시간이 한눈에 보임
6. Given 참여 등록 완료 → When 참여 취소 → Then 목록에서 제거
7. Given 50명+ 참여자 → When 이름 검색 → Then 필터링된 결과 표시
8. Given 모바일 375px → When 페이지 접근 → Then 모든 UI 정상 표시

## 7) Risk Register

| Risk | Impact | Likelihood | Mitigation | Trigger |
|------|--------|------------|------------|---------|
| Supabase 무료 한도 초과 | 서비스 중단 | Low | 50K row 이내 유지, 오래된 데이터 정리 | row 수 40K 도달 |
| 이름 중복으로 혼란 | 중복 등록/삭제 오류 | Medium | 등록 시 타임스탬프 + 고유ID 부여 | 동명이인 발생 |
| 비밀번호 유출 | 외부인 접근 | Medium | 환경변수 관리, 주기적 변경 안내 | 외부 접근 로그 감지 |
| 동시 수정 충돌 | 데이터 불일치 | Low | Supabase realtime으로 실시간 동기화 | 동시 50명 접속 |

## 8) Plan Seed (for `/plan`)

```text
[OBJECTIVE]
부트캠프 3기 토요일 오프라인 모임 관리 웹앱. 한 페이지에서 모임 현황 파악.

[IN-SCOPE]
- 공용 비밀번호 인증
- 주차별 모임 CRUD (날짜, 시간, 장소, 설명) - 누구나 생성 가능
- 셀프 RSVP (이름 + 역할(교육생/엔젤) + 한마디)
- 대시보드: 교육생/엔젤 참여 현황, 장소, 인원 수
- 참여 취소
- 50명+ 검색/필터
- 모바일 반응형
- 과거 모임 히스토리

[OUT-OF-SCOPE]
- 소셜 로그인, 채팅, 결제, 알림, 네이티브 앱

[TECH STACK]
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Realtime)
- Vercel 무료 배포

[MUST-HAVE ACCEPTANCE CRITERIA]
- 비밀번호 인증 후 대시보드 접근
- 모임 생성 (날짜/시간/장소/설명)
- 셀프 RSVP (이름 + 역할 + 한마디) → 실시간 반영
- 교육생 N명 / 엔젤 N명 한눈에 표시
- 참여 취소 가능
- 모바일 375px 대응

[CONSTRAINTS]
- Vercel 무료: Serverless, 100GB bandwidth
- Supabase 무료: 500MB, 50K rows
- 개인정보 최소 수집 (이름만)

[OPEN DECISIONS]
- 없음 (모두 확정)

[TOP RISKS]
- Supabase 무료 한도 → 오래된 데이터 정리로 대응
- 이름 중복 → 고유ID + 타임스탬프로 구분
```

## 결정 요약

| 항목 | 결정 |
|------|------|
| 참여 방식 | 셀프 RSVP (이름 + 역할 + 한마디) |
| 인증 | 공용 비밀번호 |
| 규모 | 50명+ (검색/필터 필요) |
| DB | Supabase 무료 |
| 모임 생성 | 누구나 가능 |
| 엔젤 | 여러 명, 교육생과 구분 표시 |
