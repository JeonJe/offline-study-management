# Feature Flag 검증 매트릭스

## 현재 플래그

| 플래그 | 함수 | 기본값 | ON 값 | 보호하는 화면/기능 |
|--------|------|--------|-------|--------------------|
| `OPERATING_UNITS_ENABLED` | `isOperatingUnitsEnabled()` | OFF | `1`, `true` | `/admin/operating-units`, `/admin`의 "기수 관리" 카드 |

## ON/OFF 기대 동작

| 케이스 | 환경값 | `/admin` 카드 | `/admin/operating-units` 직접 접근 | 기존 모임/뒷풀이 흐름 | 판정 |
|--------|--------|---------------|-------------------------------------|------------------------|------|
| 기본값 | 미설정 | 기수 관리 카드 숨김 | `/admin`으로 redirect | 변화 없음 | ✅ PASS |
| 명시 OFF | `0` 또는 `false` | 기수 관리 카드 숨김 | `/admin`으로 redirect | 변화 없음 | ✅ PASS |
| 명시 ON | `1` | 기수 관리 카드 표시 | 화면 접근 가능 | 변화 없음 | ✅ PASS |
| 명시 ON | `true` | 기수 관리 카드 표시 | 화면 접근 가능 | 변화 없음 | ✅ PASS |

## 교차 케이스

현재 활성 feature flag는 `OPERATING_UNITS_ENABLED` 하나뿐이다. 새 기능 flag가 추가되면 아래 형식으로 행을 추가한다.

| 케이스 | OPERATING_UNITS_ENABLED | 신규 플래그 | 기대 결과 |
|--------|-------------------------|-------------|-----------|
| 일부 ON | ON | OFF | 기수 관리만 노출, 신규 플래그 기능은 기존 화면 유지 |
| 일부 ON | OFF | ON | 기수 관리는 숨김, 신규 플래그 기능만 노출 |
| 모두 ON | ON | ON | 두 기능 모두 노출, 기존 모임/뒷풀이 회귀 유지 |
| 모두 OFF | OFF | OFF | 신규 기능 카드/라우트 숨김, 기존 흐름만 유지 |

## 신규 플래그 추가 규칙

1. `src/lib/feature-flags.ts`에 `is{Name}Enabled()` 함수를 추가한다.
2. 환경값은 `1` 또는 `true`만 ON으로 인정한다.
3. UI 카드와 직접 라우트 접근을 모두 gate 처리한다.
4. 이 문서의 현재 플래그 표와 교차 케이스를 갱신한다.
5. 필요한 경우 모바일 캡처(`scripts/capture-mobile-screenshots.mjs`) 대상 route를 갱신한다.

## 2026-05-01 검증 메모

- `src/app/admin/page.tsx`는 `isOperatingUnitsEnabled()`로 "기수 관리" 카드를 필터링한다.
- `src/app/admin/operating-units/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`는 flag OFF일 때 `/admin`으로 redirect한다.
- SM-6B 모바일 캡처는 현재 환경의 ON 상태에서 `/admin/operating-units`까지 접근 가능함을 확인했다.
