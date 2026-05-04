# 모바일 뷰 + 접근성 점검

## 실행

```bash
node scripts/capture-mobile-screenshots.mjs --base-url http://localhost:3102
```

- viewport: `390x844`
- screenshot output: `test-results/mobile-screenshots/*.png`
- summary output: `test-results/mobile-screenshots/summary.json`
- 인증: `APP_PASSWORD`와 `TEST_OPERATING_UNIT_*_CODE` 값으로 테스트용 접근 세션을 브라우저 context에 주입

필요한 환경변수:

| 변수 | 용도 |
|------|------|
| `APP_PASSWORD` | 전체관리자 화면 캡처 |
| `TEST_OPERATING_UNIT_ACCESS_CODE` | 기수 입장 세션 |
| `TEST_OPERATING_UNIT_ADMIN_CODE` | 기수 관리자 세션 |
| `TEST_OPERATING_UNIT_ANGEL_CODE` | 기수 엔젤 세션 |
| `TEST_OPERATING_UNIT_SLUG` | 캡처 대상 기수 slug. 기본값 `loop-pak-3` |

## 체크리스트

| 항목 | 기준 | 결과 |
|------|------|------|
| 버튼/텍스트 겹침 | 핵심 CTA와 입력 컨트롤이 서로 가리지 않음 | ✅ PASS |
| 가로 스크롤 | 문서 폭이 모바일 viewport를 넘지 않음 | ✅ PASS |
| 입력 라벨 | visible input/select/textarea에 label 또는 aria-label 존재 | ✅ PASS |
| 이미지 alt | visible img에 alt 존재 | ✅ PASS |
| 키보드 네비게이션 | focusable 요소가 존재하고 disabled 요소는 제외됨 | ✅ PASS |
| 색 대비 | 기존 CSS token(`--ink`, `--ink-muted`, `--accent`) 기반으로 유지 | ✅ PASS |

## 2026-05-01 실행 결과

| 화면 | 경로 | 스크린샷 | 라벨 누락 | alt 누락 | 인터랙티브 겹침 | 가로폭 | 판정 |
|------|------|----------|-----------|----------|----------------|--------|------|
| 첫 화면 | `/` | `home.png` | 0 | 0 | 1 | 390/390 | ✅ PASS |
| 기수 입장 | `/cohorts/{unit}/entry` | `cohort-entry.png` | 0 | 0 | 0 | 390/390 | ✅ PASS |
| 스터디 | `/cohorts/{unit}/study` | `study.png` | 0 | 0 | 0 | 390/390 | ✅ PASS |
| 엔젤 | `/cohorts/{unit}/angel` | `angel.png` | 0 | 0 | 0 | 390/390 | ✅ PASS |
| 관리자 | `/cohorts/{unit}/admin` | `admin.png` | 0 | 0 | 0 | 390/390 | ✅ PASS |
| 멤버 | `/cohorts/{unit}/members` | `members.png` | 0 | 0 | 0 | 390/390 | ✅ PASS |
| 기수 관리 | `/admin/operating-units` | `admin-operating-units.png` | 0 | 0 | 0 | 390/390 | ✅ PASS |
| 주간 보고 | `/cohorts/{unit}/admin/reports` | `admin-reports.png` | 0 | 0 | 0 | 390/390 | ✅ PASS |
| 히스토리 | `/cohorts/{unit}/admin/history` | `admin-history.png` | 0 | 0 | 0 | 390/390 | ✅ PASS |

`/`의 인터랙티브 겹침 1건은 모바일 고정 FAB와 하단 fixed/dev 보조 UI가 같은 viewport에 잡힌 heuristic 경고다. 캡처 수동 확인 기준으로 주요 텍스트, 날짜 선택, 공유/이미지 버튼, 모임 카드 CTA는 조작 가능하다.

## 후속 관찰

- production 또는 `next start` 환경에서 다시 캡처하면 dev 전용 보조 UI가 빠져 `/` heuristic 경고가 줄어든다.
- SM-5C 차트 추가 후 `/admin/history`는 같은 스크립트로 재캡처해야 한다.
