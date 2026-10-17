import { defineConfig, devices } from '@playwright/test';

// 주의: 이 E2E 테스트는 앱의 '연습 모드(모의 데이터)'로 학습 흐름을 검증한다.
// 실제 Bluetooth 장치 연결은 브라우저 자동화로 검증할 수 없으며,
// docs/hardware-checklist.md 의 실물 점검표로 따로 확인해야 한다.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    locale: 'ko-KR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
