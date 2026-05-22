import { test, expect } from '@playwright/test';

async function loginViaApi(page, username) {
  await page.request.post('http://localhost:3000/api/auth/register', {
    data: { username, password: '123456' }
  });

  const loginRes = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { username, password: '123456' }
  });
  const { token, id } = await loginRes.json();

  await page.goto('/');
  await page.evaluate(({ token, id, username }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ id, username }));
    location.reload();
  }, { token, id, username });

  await page.waitForURL('/', { timeout: 5000 });
}

test.describe('Statistics Page', () => {
  test('displays year selector with data', async ({ page }) => {
    await loginViaApi(page, 'stats_1');

    for (const stars of ['3,4,5', '6,6', '3,3,3']) {
      await page.fill('input[placeholder*="逗号分隔"]', stars);
      await page.click('button:has-text("提交")');
      await page.waitForTimeout(150);
    }

    await page.goto('/statistics');
    await page.waitForSelector('.select', { timeout: 5000 });
    await expect(page.locator('.select').first()).toBeVisible();
  });

  test('has chart and month selector', async ({ page }) => {
    await loginViaApi(page, 'stats_2');

    await page.fill('input[placeholder*="逗号分隔"]', '3,4,5,6');
    await page.click('button:has-text("提交")');
    await page.waitForTimeout(150);

    await page.goto('/statistics');
    await page.waitForSelector('.select', { timeout: 5000 });
    await expect(page.locator('.select')).toHaveCount(2);

    const hasContent = await page.locator('.chart-box, canvas, table').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('requires auth', async ({ page }) => {
    await loginViaApi(page, 'stats_3');

    await page.click('button:has-text("退出")');
    await page.goto('/statistics');
    await expect(page).toHaveURL('/login');
  });
});
