import { test, expect } from '@playwright/test';
import { launchApp, ensurePastFirstRun, signInAsAdmin, apiJson } from './helpers.mjs';

// Regression coverage for the "demo data removed" and "Shifts sidebar removed"
// changes: nothing in the UI or API may reference them anymore.

async function signInToDashboard(page) {
  await page.waitForLoadState('domcontentloaded');
  await ensurePastFirstRun(page);
  await expect(page.getByText('Welcome back')).toBeVisible();
  await signInAsAdmin(page);
  await expect(page.getByText('Where would you like to go?')).toBeVisible({ timeout: 20_000 });
  await page.getByText('Dashboard', { exact: false }).first().click();
  await expect(page.getByText("Today's Sales")).toBeVisible({ timeout: 20_000 });
}

test('sidebar no longer offers Shifts but keeps Sales and Reports', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await signInToDashboard(page);

    const nav = page.locator('[data-slot="sidebar-menu-button"]');
    await expect(nav.filter({ hasText: 'Sales' })).toHaveCount(1);
    await expect(nav.filter({ hasText: 'Reports' })).toHaveCount(1);
    await expect(nav.filter({ hasText: 'Shifts' })).toHaveCount(0);
    await expect(page.getByText('Shifts', { exact: true })).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('Catalog has no Seed demo button', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await signInToDashboard(page);

    await page.locator('[data-slot="sidebar-menu-button"]', { hasText: 'Menu' }).click();
    await expect(page.getByText('New product', { exact: false })).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('button', { name: 'Seed demo' })).toHaveCount(0);
    await expect(page.getByText('Seed demo', { exact: true })).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('Settings has no Demo data section', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await signInToDashboard(page);

    await page.locator('[data-slot="sidebar-menu-button"]', { hasText: 'Settings' }).click();
    await expect(page.getByText('Save settings', { exact: true })).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText('Demo data', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Seed demo catalog' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Bulk delete catalog/ })).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('demo API endpoints return 404', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await signInToDashboard(page);

    const seed = await apiJson(page, 'POST', '/demo/seed', {});
    expect(seed.status).toBe(404);

    const clear = await apiJson(page, 'POST', '/demo/clear', {});
    expect(clear.status).toBe(404);

    // The shift API the store depends on still responds.
    const shift = await apiJson(page, 'GET', '/shifts/open?till=1');
    expect(shift.status).toBe(200);
  } finally {
    await app.close();
  }
});
