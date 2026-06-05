// ── Dashboard E2E Tests (Playwright) ──

import { test, expect } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3003';

test.describe('Dashboard E2E', () => {
  test('loads login page', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await expect(page.locator('text=Forge')).toBeVisible();
    await expect(page.locator('text=Sign in with Keycloak')).toBeVisible();
  });

  test('shows login page title', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await expect(page).toHaveTitle(/Forge Dashboard/);
  });

  test('redirects unauthenticated to login', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`);
    // Should redirect to login or show loading
    await page.waitForURL(/\/login/);
  });

  test('login page has Keycloak SSO button', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/login`);
    const loginButton = page.locator('button', { hasText: 'Sign in with Keycloak' });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
  });
});

test.describe('Admin API Access', () => {
  test('rejects unauthenticated API requests', async ({ page }) => {
    // Direct API call without auth
    const response = await page.request.get(`${DASHBOARD_URL.replace('3003', '3000')}/v1/admin/health`);
    expect(response.status()).toBe(401);
  });

  test('health endpoint returns JSON', async ({ page }) => {
    const response = await page.request.get(`${DASHBOARD_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });
});
