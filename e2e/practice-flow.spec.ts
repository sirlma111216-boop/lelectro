/**
 * 연습 모드(모의 데이터)로 주요 학습 흐름을 검증한다.
 * 이 테스트는 실제 Bluetooth 장치 연결을 검증하지 않는다 (docs/hardware-checklist.md 참고).
 */
import { expect, test, type Page } from '@playwright/test';

async function enablePractice(page: Page) {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  const toggle = page.getByTestId('practice-toggle');
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
}

test.describe('연습 모드 POE 흐름', () => {
  test('탐구 1: 예측 → 관찰 기록 → 설명 → 정리 → 보고서, 새로고침 후 복구', async ({ page }) => {
    await enablePractice(page);
    await page.getByTestId('start-1').click();
    await expect(page).toHaveURL(/\/inquiry\/1\//);
    await expect(page.getByTestId('current-stage')).toHaveText('실험 준비');

    // 예측 전에는 관찰 단계 버튼이 비활성
    await expect(page.getByTestId('stage-observe')).toBeDisabled();

    await page.getByTestId('go-predict').click();
    await page.locator('input[name="claim_stance"]').first().check();
    await page.locator('#pf-claim_reason').fill('전구가 전류를 써서 뒤쪽은 줄어든다');
    await page.getByTestId('pred-reason').fill('전구가 빛을 내려면 전류를 소모할 것 같다');
    await page.getByTestId('submit-prediction').click();
    await expect(page.getByText('최초 예측 (보존)')).toBeVisible();

    await page.getByTestId('go-observe').click();
    await expect(page.getByTestId('current-stage')).toHaveText('관찰 (O)');
    await page.getByTestId('connect-current').click();
    await expect(page.getByTestId('device-card-current')).toContainText('모의 데이터');

    await page.getByTestId('measure-start').click();
    await expect(page.getByTestId('live-current')).not.toContainText('측정 대기', { timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.getByTestId('quick-window-2').click();
    await expect(page.getByTestId('save-record')).toBeEnabled();
    await page.getByTestId('save-record').click();
    const table = page.getByTestId('records-table');
    await expect(table).toContainText('A: 전구 앞');
    await expect(table).toContainText('모의 데이터');
    await expect(table).not.toContainText('실측');

    // 같은 구간 재사용 차단
    await page.getByTestId('quick-window-2').click();
    await expect(page.getByTestId('save-record')).toBeDisabled();
    await expect(page.getByText(/이미 .* 기록에 사용되었습니다/)).toBeVisible();

    await page.waitForTimeout(2500);
    await page.getByTestId('quick-window-2').click();
    await page.getByTestId('save-record').click();
    await expect(table).toContainText('B: 전구 뒤');
    await page.getByTestId('measure-stop').click();

    // 새로고침 후 기록 복구
    const url = page.url();
    await page.reload();
    await expect(page.getByTestId('records-table')).toContainText('B: 전구 뒤');
    expect(page.url()).toBe(url);

    await page.getByTestId('go-explain').click();
    await page.getByTestId('ex-claim').fill('전구 앞과 뒤의 전류는 거의 같다.');
    await page.locator('[data-testid="records-table"] input[type="checkbox"]').first().check();
    await page.getByTestId('quote-evidence').click();
    await expect(page.getByTestId('ex-evidence')).toHaveValue(/전류 평균/);
    await page.getByTestId('go-summary').click();
    await expect(page.getByTestId('current-stage')).toHaveText('탐구 정리');
    await page.getByTestId('complete').click();
    await expect(page.getByText(/완료 표시:/)).toBeVisible();

    const sessionId = url.split('/').pop()!;
    await page.goto(`/report/${sessionId}`);
    const report = page.getByTestId(`report-${sessionId}`);
    await expect(report).toContainText('전구를 지나면 전류가 줄어들까?');
    await expect(report).toContainText('모의 데이터');
    await expect(report).toContainText('최초 예측');
    await expect(report).toContainText('전구 앞과 뒤의 전류는 거의 같다.');
  });

  test('탐구 2: 두 센서의 공통 구간으로 (V, I) 쌍을 저장하고, 한 센서가 끊기면 저장을 막는다', async ({ page }) => {
    await enablePractice(page);
    await page.getByTestId('start-2').click();
    await page.getByTestId('go-predict').click();
    await page.getByRole('button', { name: /점 추가/ }).click();
    await page.getByRole('button', { name: /점 추가/ }).click();
    const nums = page.locator('table.data input[type="number"]');
    await nums.nth(0).fill('1');
    await nums.nth(1).fill('10');
    await nums.nth(2).fill('2');
    await nums.nth(3).fill('20');
    await page.locator('input[name="double"]').first().check();
    await page.getByTestId('pred-reason').fill('비례할 것 같다');
    await page.getByTestId('submit-prediction').click();
    await page.getByTestId('go-observe').click();

    await page.getByTestId('connect-current').click();
    await page.getByTestId('connect-voltage').click();
    await expect(page.getByTestId('live-voltage')).toBeVisible();
    await page.getByTestId('measure-start').click();
    await page.waitForTimeout(3000);
    await page.getByTestId('quick-window-2').click();
    await expect(page.getByTestId('save-record')).toBeEnabled();
    await page.getByTestId('save-record').click();
    const table = page.getByTestId('records-table');
    await expect(table).toContainText('전압 단계 1');
    await expect(table).toContainText('전압 평균 (V)');
    await expect(table).toContainText('전류 평균 (mA)');

    // 전압 센서 끊김 → 쌍 저장 차단
    await page.getByLabel('전압 센서 연결 끊김 시뮬레이션').check();
    await page.waitForTimeout(2500);
    await page.getByTestId('quick-window-2').click();
    await expect(page.getByTestId('save-record')).toBeDisabled();
    await expect(page.getByText(/전압/).and(page.locator('.notice-warn li'))).toBeVisible();
    await page.getByTestId('measure-stop').click();

    await page.getByTestId('go-explain').click();
    await expect(page.locator('svg[aria-label*="산점도"]')).toBeVisible();
  });

  test('홈 화면과 저장 목록에 진행률 표시가 없다', async ({ page }) => {
    await enablePractice(page);
    await expect(page.locator('body')).not.toContainText('%');
    await expect(page.locator('progress')).toHaveCount(0);
    await page.goto('/sessions');
    await expect(page.locator('progress')).toHaveCount(0);
  });
});
