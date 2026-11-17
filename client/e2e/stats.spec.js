import { test, expect } from '@playwright/test';

async function loginViaApi(page, username) {
  await page.request.post('http://localhost:3000/api/auth/register', {
    data: { username, password: '123456', inviteCode: 'local-e2e-invite' }
  });

  const loginRes = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { username, password: '123456', inviteCode: 'local-e2e-invite' }
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
      await page.fill('input[placeholder*="请输入星级"]', stars);
      await page.click('button:has-text("提交")');
      await page.waitForTimeout(150);
    }

    await page.goto('/statistics');
    await page.waitForSelector('.select', { timeout: 5000 });
    await expect(page.locator('.select').first()).toBeVisible();
  });

  test('has chart and month selector', async ({ page }) => {
    await loginViaApi(page, 'stats_2');

    await page.fill('input[placeholder*="请输入星级"]', '3,4,5,6');
    await page.click('button:has-text("提交")');
    await page.waitForTimeout(150);

    await page.goto('/statistics');
    await page.waitForSelector('.select', { timeout: 5000 });
    await expect(page.locator('.select')).toHaveCount(2);

    // Assert the chart actually rendered, not merely that *something* in the card is
    // visible. The previous version was
    //   locator('.chart-box, canvas, table').first().isVisible()
    // which the table alone satisfies - a blank chart still passed. That is how a
    // missing ECharts registration could reach production unnoticed.
    const canvas = page.locator('.stats-grid .chart-box canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // A real pie draws geometry; an empty one has a blank canvas of the same size.
    const geometry = await page.locator('.stats-grid .chart-box canvas').first().evaluate((el) => {
      const ctx = el.getContext('2d');
      if (!ctx) return { pixels: 0, note: 'no 2d context' };
      const { data } = ctx.getImageData(0, 0, el.width, el.height);
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) painted++;
      }
      return { pixels: painted, width: el.width, height: el.height };
    });
    expect(geometry.pixels, `chart canvas has ${geometry.pixels} painted pixels (blank chart?)`)
      .toBeGreaterThan(1000);

    // The pie labels carry the star glyph, so the legend/labels must be present.
    await expect(page.locator('.stats-grid table')).toContainText('3★');
  });

  test('requires auth', async ({ page }) => {
    await loginViaApi(page, 'stats_3');

    await page.click('button:has-text("退出")');
    await page.goto('/statistics');
    await expect(page).toHaveURL('/login');
  });
});
