# 전류와 전압 탐구실

중학교 과학 ‘전기와 자기’([9과14-02], [9과14-03]) 수업용 한국어 웹앱.
Vernier **Go Direct 전류 센서(GDX-CUR)** 와 **전압 센서(GDX-VOLT)** 를 Web Bluetooth 로 브라우저에 직접 연결해 실제 데이터를 수집하고,
네 가지 탐구를 **예측(P) → 관찰(O) → 설명(E)** 흐름으로 진행한다. 로그인·서버 DB·외부 AI 없이 동작하며, 학생 입력과 측정 데이터는 사용 중인 기기(IndexedDB)에만 저장된다.

> 이 앱은 교육부나 Vernier 의 공식 인증 앱이 아니다. 저전압 직류 회로 실험만 대상으로 한다.

## 네 가지 탐구

| # | 제목 | 센서 | 교육과정 |
| --- | --- | --- | --- |
| 1 | 전구를 지나면 전류가 줄어들까? | 전류 1 | [9과14-02] |
| 2 | 전압을 높이면 전류는 어떻게 달라질까? | 전압 1 + 전류 1 | [9과14-02] |
| 3 | 직렬 회로의 전압은 어떻게 나뉠까? | 전압 1 | [9과14-03] |
| 4 | 병렬 가지를 추가하면 전체 전류는 어떻게 달라질까? | 전류 1 (+전압 1 선택) | [9과14-03] |

각 탐구는 실험 준비 → 예측 → 관찰 → 설명 → 탐구 정리 순서이며, 예측을 제출해야 본 실험 기록을 시작할 수 있다. 네 탐구는 센서 관리와 데이터 처리를 공유하되 예측·측정·설명 상태는 독립적으로 저장된다.

## 기술 구성

- React 19 + TypeScript + Vite 8
- `@vernier/godirect` 1.8.3 (공식 Go Direct JavaScript SDK, npm 패키지를 번들에 포함, lockfile 고정)
- uPlot (실시간 시간 그래프), 직접 그린 SVG(산점도·막대·회로도·개념 모형)
- zustand (상태), idb (IndexedDB)
- Vitest(단위), Playwright(연습 모드 흐름 E2E)
- Cloudflare Workers Static Assets 배포 (`wrangler.jsonc`)

지원 환경: 데스크톱 Chrome·Edge, HTTPS 또는 localhost. Web Bluetooth 가 없는 브라우저에서는 기록 열람·보고서·연습 모드만 사용할 수 있다.

## 실행

```bash
npm ci
```

```bash
npm run dev
```

브라우저에서 http://localhost:5173 을 연다. 그 밖의 명령:

| 명령 | 내용 |
| --- | --- |
| `npm run typecheck` | TypeScript 검사 |
| `npm test` | Vitest 단위 테스트 (`test/`) |
| `npm run test:e2e` | Playwright E2E — 빌드 후 미리보기 서버로 연습 모드 흐름 검증 (처음엔 `npx playwright install chromium`) |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run deploy` | `wrangler deploy` (수동 배포 시, 로그인 필요) |

Node 22 이상 (`.node-version` = 22, CI 와 Cloudflare 빌드가 같은 값을 쓴다).

## 폴더 구조

```
src/
  sensors/        SDK 어댑터(godirectAdapter), 센서 관리자(SensorManager), 장치 프로필, 오류 분류, 모의 어댑터
  data/           단위 변환, 구간 통계, 기록 계층(Recorder), CSV·JSON 내보내기/가져오기
  storage/        IndexedDB (sessions / segments / settings)
  poe/            세션 타입·전이 규칙·스토어, 교사 설정
  inquiries/      네 탐구의 선언적 정의 (콘텐츠, 측정 슬롯, 예측 항목, 규칙 기반 피드백)
  components/     차트, 회로도(SVG), 센서 패널, POE 단계 화면, 결과 화면, 기록표
  pages/          홈, 탐구, 저장한 탐구, 교사용 설정, 보고서
  report/         인쇄용 보고서 뷰
test/             Vitest
e2e/              Playwright
docs/             센서 연결·수업 사용·배포·실물 검증 문서
```

## 문서

- [docs/sensor-integration.md](docs/sensor-integration.md) — SDK 1.8.3 에서 확인한 API·단위·이벤트, 앱 어댑터 설계, 실물 미확인 항목
- [docs/classroom-guide.md](docs/classroom-guide.md) — 수업 사용 안내 (준비물, 안전, 흐름, 연습 모드, 내보내기)
- [docs/deployment.md](docs/deployment.md) — GitHub 업로드와 Cloudflare Workers 배포 절차
- [docs/hardware-checklist.md](docs/hardware-checklist.md) — 실물 센서 검증 체크리스트
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) — 제3자 라이선스 고지

## 데이터와 개인정보

- 모든 데이터는 브라우저 IndexedDB 에 자동 저장되고 외부로 전송되지 않는다. 새로고침 후 학습 기록은 복구되지만 Bluetooth 연결은 다시 해야 한다.
- 원자료 CSV·조건별 요약 CSV·세션 JSON(다시 가져오기 가능)·인쇄용 보고서(단일/통합)를 내보낼 수 있다. CSV 는 UTF-8(BOM) 이며 값은 내부 기준 단위(A, V, s)와 단위 열을 함께 담는다.
- 연습 모드(모의 데이터)는 사용자가 직접 켜야 하며, 모의 세션은 실측 세션과 분리되고 모든 화면·보고서에 ‘모의 데이터’ 로 표시된다. 실측 연결 실패 시 자동 전환되지 않는다.

## 검증 상태 (요약)

- 자동 검증: 타입 검사, Vitest(단위 변환·통계·기록 구간·세션 규칙·센서 관리자·저장·내보내기·피드백), Playwright(연습 모드 흐름), 빌드 — GitHub Actions `CI` 워크플로가 수행한다.
- 실물 센서 검증: 아직 수행되지 않았다. `docs/hardware-checklist.md` 를 따라 확인한 뒤 결과를 기록해야 한다. 브라우저 테스트의 모의 장치는 실제 Bluetooth 검증이 아니다.
