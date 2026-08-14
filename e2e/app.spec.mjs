import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainEntry = path.join(__dirname, '..', 'electron', 'main.js');

// A fresh, isolated user-data dir per run so first-run always behaves the same.
function freshUserDataDir() {
  const dir = path.join(os.tmpdir(), `pos-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function ensurePastFirstRun(page) {
  const wizard = page.getByText('Welcome to Store POS');
  const login = page.getByText('Welcome back');
  // Wait until either the first-run wizard or the login screen has rendered.
  await wizard.or(login).first().waitFor({ state: 'visible', timeout: 20_000 });

  if (await wizard.isVisible().catch(() => false)) {
    await page.locator('#store').fill('Test Store');
    await page.locator('input[type="password"]').fill('123456');
    await page.keyboard.press('Enter');
    await expect(login).toBeVisible({ timeout: 20_000 });
  }
}

async function signInAsAdmin(page) {
  await page.getByText('Sign in with password instead').click();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function launchApp() {
  const userDataDir = freshUserDataDir();
  return electron.launch({
    args: [mainEntry, '--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`],
    env: { ...process.env },
  });
}

test('boots, serves the API, and signs in to the till', async () => {
  const electronApp = await launchApp();
  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    const apiHealthy = await page.evaluate(async () => {
      try {
        const res = await fetch('http://127.0.0.1:8001/');
        return (await res.json())?.status === 'ok';
      } catch {
        return false;
      }
    });
    expect(apiHealthy, 'Electron API on :8001 should be healthy').toBe(true);

    await ensurePastFirstRun(page);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await signInAsAdmin(page);

    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });

    await page.getByText('Till', { exact: false }).first().click();
    await expect(page.getByText('Cart', { exact: false })).toBeVisible({ timeout: 20_000 });
  } finally {
    await electronApp.close();
  }
});

test('opens the Dashboard with sales KPIs', async () => {
  const electronApp = await launchApp();
  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await ensurePastFirstRun(page);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await signInAsAdmin(page);

    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await page.getByText('Dashboard', { exact: false }).first().click();
    await expect(page.getByText("Today's Sales")).toBeVisible({ timeout: 20_000 });
  } finally {
    await electronApp.close();
  }
});
