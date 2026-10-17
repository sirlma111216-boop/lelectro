# 배포 안내 — GitHub + Cloudflare Workers Static Assets

구성 원칙
- **GitHub Actions 는 검증만** 한다 (`.github/workflows/ci.yml`: `npm ci` → 타입 검사 → Vitest → 빌드 → Playwright).
- **배포는 Cloudflare Workers Builds(Git 연동)가** 한다. 두 곳에서 배포하지 않으므로 중복 배포가 없다.
- 서버 코드·DB 없음. `wrangler.jsonc` 는 assets-only Worker 설정이며 `main` 이 없다.
- 계정 토큰·자격 증명은 저장소에 넣지 않는다 (`.gitignore` 의 `.env*`, `.dev.vars`).

이 프로젝트는 Cloudflare Pages 에 연결된 적이 없으므로 Workers Static Assets 로만 구성했다. 만약 이미 Pages 프로젝트가 있다면 그 배포 방식을 유지하고 이 문서의 Workers 설정과 섞지 말 것.

## 1. 로컬 확인

```bash
npm ci
```

```bash
npm run build
```

`dist/` 에 `index.html`, `assets/`, `_headers` 가 생긴다. `wrangler.jsonc` 의 `assets.directory` (`./dist`) 와 Vite `build.outDir` 이 같다.

## 2. GitHub 저장소 만들기와 업로드

저장소 주소가 아직 정해지지 않았으므로 아래 절차를 직접 수행한다. (이 프로젝트는 임의 계정에 저장소를 만들지 않았다.)

1. GitHub 에서 새 저장소를 만든다 (비공개/공개는 학교 정책에 따라). README·.gitignore 는 추가하지 않는다 (이미 있음).
2. 로컬에서:

```bash
git remote add origin https://github.com/<계정>/<저장소>.git
```

```bash
git push -u origin main
```

3. 푸시되면 GitHub Actions 의 `CI` 워크플로가 자동으로 돈다. Actions 탭에서 통과를 확인한다.

## 3. Cloudflare Workers 와 GitHub 연동 (배포)

참고: https://developers.cloudflare.com/workers/ci-cd/builds/ , https://developers.cloudflare.com/workers/static-assets/

1. Cloudflare 대시보드 → **Workers & Pages** → **Create application** → **Workers** 탭 → **Connect to Git** (또는 Import a repository).
2. GitHub 계정을 인증하고 **Cloudflare Workers & Pages GitHub App** 설치 시 **Only select repositories** 로 이 저장소만 허용한다.
3. 프로젝트 설정:

| 항목 | 값 |
| --- | --- |
| Worker 이름 | `elect-lab` — **`wrangler.jsonc` 의 `name` 과 같아야 한다** (다르면 빌드 실패) |
| Git branch (운영 브랜치) | `main` |
| Root directory | `/` (저장소 루트) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (기본값) |
| Node 버전 | 저장소의 `.node-version`(22) 을 빌드 이미지가 읽는다. 필요하면 Build variables 에 `NODE_VERSION=22` |

4. **Save and Deploy**. 이후 `main` 에 푸시할 때마다 빌드·배포되고, 다른 브랜치는 Preview 빌드(미리보기 URL)가 만들어진다(설정에서 켤 수 있음).
5. 배포 주소(`https://elect-lab.<계정>.workers.dev` 또는 연결한 도메인)는 HTTPS 이므로 Web Bluetooth 를 쓸 수 있다.

### 배포 후 확인
- `/`, `/inquiry/1/<아무 id>`, `/sessions` 를 직접 열거나 새로고침해도 200 으로 `index.html` 이 온다 (`not_found_handling: "single-page-application"`).
- 응답 헤더에 `Permissions-Policy: bluetooth=(self)`, `X-Content-Type-Options: nosniff` 가 있다 (`public/_headers` → `dist/_headers`).
- 실제 센서 연결은 `docs/hardware-checklist.md` 의 H 항목으로 확인한다.

## 4. 수동 배포 (선택)

Git 연동 없이 올리려면 Cloudflare 계정으로 로그인한 뒤:

```bash
npx wrangler login
```

```bash
npm run build
```

```bash
npx wrangler deploy
```

Git 연동과 수동 배포를 함께 쓰면 두 경로가 같은 Worker 를 덮어쓰므로, 운영에서는 한 가지만 쓴다.

## 5. 변경 사항

- `compatibility_date` 는 설정 당시 날짜(2026-10-16)다. Cloudflare 가 권장하는 대로 주기적으로 올려도 된다.
- SPA 라우트를 추가해도 Wrangler 설정은 바꿀 필요가 없다.
- 헤더를 바꾸려면 `public/_headers` 를 수정한다. Worker 코드가 없으므로 `_headers` 가 그대로 적용된다.
