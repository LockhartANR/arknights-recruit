import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state and reload so Pinia re-initializes with clean state
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForURL('/login', { timeout: 3000 });
  });

  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('redirects to login when accessing statistics without auth', async ({ page }) => {
    await page.goto('/statistics');
    await expect(page).toHaveURL('/login');
  });

  test('registers a new user and redirects to home', async ({ page }) => {
    const username = 'doctor_' + Date.now();
    await page.goto('/register');

    await page.fill('input[placeholder*="3-20位"]', username);
    await page.fill('input[placeholder*="至少6位"]', 'password123');
    await page.fill('input[placeholder*="再次输入"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('.card-title').first()).toContainText('公招结果录入');
  });

  test('shows error for duplicate username', async ({ page }) => {
    const username = 'dup_' + Date.now();
    // Register the username first
    await page.goto('/register');
    await page.fill('input[placeholder*="3-20位"]', username);
    await page.fill('input[placeholder*="至少6位"]', 'password123');
    await page.fill('input[placeholder*="再次输入"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 5000 });

    // Logout so we can access register page again
    await page.click('button:has-text("退出")');

    // Try registering the same username again
    await page.goto('/register');
    await page.fill('input[placeholder*="3-20位"]', username);
    await page.fill('input[placeholder*="至少6位"]', 'password123');
    await page.fill('input[placeholder*="再次输入"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('.form-error')).toContainText('已存在');
  });

  test('logs in with existing user', async ({ page }) => {
    const username = 'login_' + Date.now();
    // Register first via UI
    await page.goto('/register');
    await page.fill('input[placeholder*="3-20位"]', username);
    await page.fill('input[placeholder*="至少6位"]', 'password123');
    await page.fill('input[placeholder*="再次输入"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 5000 });

    // Logout
    await page.click('button:has-text("退出")');

    // Login
    await page.goto('/login');
    await page.fill('input[placeholder="请输入用户名"]', username);
    await page.fill('input[placeholder="请输入密码"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 5000 });
    await expect(page.locator('.username')).toContainText(username);
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[placeholder="请输入用户名"]', 'noone');
    await page.fill('input[placeholder="请输入密码"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.form-error')).toContainText('错误');
  });

  test('redirects logged-in user away from login page', async ({ page }) => {
    // Register and login via API, inject token with addInitScript
    const username = 'redirect_' + Date.now();
    await page.request.post('http://localhost:3000/api/auth/register', {
      data: { username, password: '123456' }
    });
    const loginRes = await page.request.post('http://localhost:3000/api/auth/login', {
      data: { username, password: '123456' }
    });
    const { token, id } = await loginRes.json();

    // Use addInitScript so token is in localStorage before SPA initializes
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify({ id: 0, username: 'test' }));
    }, token);

    // Navigate to home — should be allowed (token is in localStorage)
    await page.goto('/');
    await page.waitForURL('/', { timeout: 5000 });

    // Navigate to login — should redirect back to /
    await page.goto('/login');
    await page.waitForURL('/', { timeout: 5000 });
  });

  test('logout redirects to login and clears session', async ({ page }) => {
    // Register a fresh user
    const username = 'logout_' + Date.now();
    await page.goto('/register');
    await page.fill('input[placeholder*="3-20位"]', username);
    await page.fill('input[placeholder*="至少6位"]', 'password123');
    await page.fill('input[placeholder*="再次输入"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Click logout
    await page.click('button:has-text("退出")');
    await expect(page).toHaveURL('/login');

    // Try to access home
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('frontend validation rejects short password on register', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[placeholder*="3-20位"]', 'newuser');
    await page.fill('input[placeholder*="至少6位"]', '12345');
    await page.fill('input[placeholder*="再次输入"]', '12345');
    await page.click('button[type="submit"]');

    await expect(page.locator('.form-error')).toContainText('6位');
  });

  test('frontend validation rejects mismatched passwords', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[placeholder*="3-20位"]', 'newuser');
    await page.fill('input[placeholder*="至少6位"]', 'password123');
    await page.fill('input[placeholder*="再次输入"]', 'different');
    await page.click('button[type="submit"]');

    await expect(page.locator('.form-error')).toContainText('不一致');
  });

  test('navigates between login and register pages', async ({ page }) => {
    await page.goto('/login');
    await page.click('a:has-text("去注册")');
    await expect(page).toHaveURL('/register');

    await page.click('a:has-text("去登录")');
    await expect(page).toHaveURL('/login');
  });
});
