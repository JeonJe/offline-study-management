# README Screenshot Guide

README 스크린샷은 반드시 **가데이터**로만 관리한다.
실명, 실제 계좌, 실제 내부 정보가 보이는 이미지는 커밋 금지.

## 1. 원칙

- 실명/실제 연락처/실제 계좌번호/내부 식별자 노출 금지
- README 스크린샷은 항상 `docs/screenshots/*.png` 5개를 세트로 갱신
- 수동 캡처 대신 프로젝트 스크립트(`scripts/capture-readme-screenshots.mjs`) 사용

## 2. 준비

- 로컬 서버 실행

```bash
cd /Users/green/IdeaProjects/saturday-meetup
npm run dev
```

- `.env.local`에 아래 값이 있어야 함
  - `APP_PASSWORD`
  - `DATABASE_URL`

## 3. 캡처 실행

```bash
cd /Users/green/IdeaProjects/saturday-meetup
npm run docs:screenshots
```

동작:

- 로그인 후 5개 화면 자동 캡처
- DB의 이름 후보를 읽어 화면 텍스트를 `샘플인원NN` 형식으로 치환
- 정산자/계좌 텍스트도 샘플 값으로 치환
- 결과 파일:
  - `docs/screenshots/study-dashboard-sample.png`
  - `docs/screenshots/study-detail-sample.png`
  - `docs/screenshots/afterparty-dashboard-sample.png`
  - `docs/screenshots/afterparty-detail-sample.png`
  - `docs/screenshots/members-sample.png`

## 4. 커밋 전 체크리스트

- 스크린샷에 실명이 보이지 않는다.
- 계좌/정산자 정보가 샘플 값으로 보인다.
- 5개 파일이 모두 같은 날 갱신되었다.
- README 링크 경로가 깨지지 않았다.

## 5. 금지 사항

- README 캡처를 임의 수동 스크린샷으로 교체
- 실데이터가 포함된 이미지 커밋
- 일부 화면만 부분 갱신 후 커밋
