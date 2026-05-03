# Performance Results

작성일: 2026-05-02

## 로컬 기준선

실행 명령:

```bash
APP_PASSWORD='@@@loopers1234' ADMIN_PAGE_PASSWORD=1234 ANGEL_PAGE_PASSWORD=1234 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/performance.spec.ts --project=chromium
```

환경:

- Next.js dev server: `http://localhost:3000`
- 인증 상태: `e2e/global-setup.ts` unit login storage state
- 방문 횟수: 페이지별 3회

결과:

| 화면 | cold TTFB | warm avg TTFB | 전체 측정 |
| --- | ---: | ---: | --- |
| 대시보드 | 215ms | 112ms | 215ms, 115ms, 108ms |
| 뒷풀이 | 556ms | 98ms | 556ms, 107ms, 89ms |
| 멤버 | 520ms | 126ms | 520ms, 143ms, 108ms |
| 모임 생성 후 로드 | 36ms | - | mutation 후 redirect/load |

판정:

- 현재 측정된 warm TTFB는 모두 1초 미만이다.
- 이 문서의 수치는 로컬 dev server 기준선이다. 성능 개선을 주장하려면 같은 명령과 같은 base URL에서 전후를 비교한다.
- Vercel 원격 배포/production-like URL 성능은 사용자 요청에 따라 실행하지 않았다.

## 2026-05-03 cold 후보 재측정

측정 조건:

- Next.js dev server: `http://localhost:3000`
- 인증 상태: `meetup_auth` 전역 쿠키 직접 설정
- 각 URL 3회 연속 `curl`
- 측정값: `time_total`, `time_starttransfer`

| URL | 1회차 total / TTFB | 2회차 total / TTFB | 3회차 total / TTFB | HTTP | 판정 |
| --- | ---: | ---: | ---: | ---: | --- |
| `/cohorts/loop-pak-3/afterparty?date=2026-04-18` | 0.472s / 0.465s | 0.076s / 0.070s | 0.076s / 0.069s | 200 | cold/warm 모두 목표 내 |
| `/cohorts/loop-pak-3/angel/reports` | 0.209s / 0.206s | 0.041s / 0.038s | 0.051s / 0.049s | 200 | cold/warm 모두 목표 내 |
| `/cohorts/loop-pak-3/admin/reports` | 0.216s / 0.212s | 0.060s / 0.057s | 0.043s / 0.039s | 200 | cold/warm 모두 목표 내 |

결론:

- 2026-05-02 문서에 남긴 `/afterparty`, `/angel/reports` 첫 요청 병목 후보는 2026-05-03 로컬 dev 기준에서 재현되지 않았다.
- 현재 남은 성능 작업은 새 병목 개선보다 `e2e/performance.spec.ts`에 엔젤/관리자 보고 URL을 포함한 회귀 측정 유지다.

## 2026-05-03 Playwright 회귀 재측정

실행 명령:

```bash
set -a; source .env.local; set +a; PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e
```

결과:

| 화면 | cold TTFB | warm avg TTFB | 전체 측정 |
| --- | ---: | ---: | --- |
| 대시보드 | 84ms | 87ms | 84ms, 87ms, 86ms |
| 뒤풀이 | 95ms | 87ms | 95ms, 86ms, 88ms |
| 멤버 | 100ms | 86ms | 100ms, 87ms, 86ms |
| 엔젤 보고 | 858ms | 84ms | 858ms, 85ms, 84ms |
| 관리자 보고 | 157ms | 109ms | 157ms, 113ms, 106ms |
| 뮤테이션 후 로드 | 44ms | - | mutation 후 redirect/load |

판정:

- Chromium E2E 13개가 모두 통과했다.
- 엔젤 보고 cold TTFB는 다른 화면보다 높지만 1초 미만이고, warm avg는 100ms 미만이다.
- 관리자 보고 URL이 성능 회귀 측정 대상에 포함됐다.

## 2026-05-03 리팩터링 후 Playwright 재측정

실행 명령:

```bash
set -a; source .env.local; set +a; PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e
```

결과:

| 화면 | cold TTFB | warm avg TTFB | 전체 측정 |
| --- | ---: | ---: | --- |
| 대시보드 | 84ms | 88ms | 84ms, 92ms, 84ms |
| 뒤풀이 | 84ms | 87ms | 84ms, 88ms, 87ms |
| 멤버 | 86ms | 93ms | 86ms, 85ms, 100ms |
| 엔젤 보고 | 360ms | 81ms | 360ms, 80ms, 81ms |
| 관리자 보고 | 153ms | 110ms | 153ms, 110ms, 110ms |
| 뮤테이션 후 로드 | 40ms | - | mutation 후 redirect/load |

판정:

- Chromium E2E 13개가 모두 통과했다.
- 뒷풀이 상세 계산 함수 추출, 대시보드 모달 분리, 멤버 모달 분리 후에도 측정 대상은 모두 목표 내다.
