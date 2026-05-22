import { test, expect } from '@playwright/test';

async function loginViaApi(page, username) {
  // Register and login directly via backend API
  const apiRes = await page.request.post('http://localhost:3000/api/auth/register', {
    data: { username, password: '123456' }
  });
  if (!apiRes.ok() && apiRes.status() !== 409) {
    throw new Error(`Register API failed: ${await apiRes.text()}`);
  }

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

test.describe('Records CRUD', () => {
  test('submits and displays a new record', async ({ page }) => {
    await loginViaApi(page, 'rec_a');
    await page.fill('input[placeholder*="逗号分隔"]', '4,5,6,3');
    await page.click('button:has-text("提交")');
    await expect(page.locator('.form-success')).toContainText('已录入 4 条记录');
    await expect(page.locator('table')).toContainText('4');
  });

  test('shows error for invalid star values', async ({ page }) => {
    await loginViaApi(page, 'rec_b');
    await page.fill('input[placeholder*="逗号分隔"]', '1,2,7');
    await page.click('button:has-text("提交")');
    await expect(page.locator('.form-error')).toContainText('3、4、5、6');
  });

  test('shows error for empty input', async ({ page }) => {
    await loginViaApi(page, 'rec_c');
    await page.click('button:has-text("提交")');
    await expect(page.locator('.form-error')).toContainText('不能为空');
  });

  test('deletes a record', async ({ page }) => {
    await loginViaApi(page, 'rec_d');
    await page.fill('input[placeholder*="逗号分隔"]', '3,3,3');
    await page.click('button:has-text("提交")');
    await expect(page.locator('.form-success')).toBeVisible();
    await page.locator('button:has-text("删除")').first().click();
    await expect(page.locator('table')).not.toContainText('3,3,3');
  });
});

test.describe('Data Isolation', () => {
  test('new user sees no records from other users', async ({ page }) => {
    await loginViaApi(page, 'iso_1');
    await expect(page.locator('table')).not.toBeVisible();
  });
});

test.describe('Import / Export', () => {
  test('export downloads JSON', async ({ page }) => {
    await loginViaApi(page, 'exp_1');
    await page.fill('input[placeholder*="逗号分隔"]', '5,5');
    await page.click('button:has-text("提交")');
    await expect(page.locator('.form-success')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("导出数据")')
    ]);
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('import button present', async ({ page }) => {
    await loginViaApi(page, 'imp_1');
    await expect(page.locator('button:has-text("导入数据")')).toBeVisible();
  });
});
