import { test, expect, _electron as electron } from '@playwright/test';
import { launchApp, ensurePastFirstRun, signInAsAdmin, apiJson, freshUserDataDir } from './helpers.mjs';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainEntry = path.join(__dirname, '..', 'electron', 'main.js');

async function signInWithPIN(page, pin) {
  await page.getByText('Sign in with PIN instead').click();
  await page.locator('#pin').fill(pin);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('Login flow', () => {
  test('PIN login works (enter PIN, land on Till view)', async () => {
    const userDataDir = freshUserDataDir();
    const app = await electron.launch({
      args: [mainEntry, '--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`],
      env: { ...process.env },
    });
    try {
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');
      await ensurePastFirstRun(page);

      // Set a PIN for admin via API, then try PIN login
      await signInAsAdmin(page);
      await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });

      // Set PIN via API
      await apiJson(page, 'POST', '/users/post', {
        id: 1,
        username: 'admin',
        fullname: 'Administrator',
        pin: '1234',
      });

      // Sign out and try PIN login
      await page.getByRole('button', { name: 'Sign out' }).click();
      await ensurePastFirstRun(page);

      await signInWithPIN(page, '1234');
      await expect(page.getByText('Till', { exact: false })).toBeVisible({ timeout: 20_000 });
    } finally {
      await app.close();
    }
  });

  test('wrong PIN shows error and stays on login', async () => {
    const userDataDir = freshUserDataDir();
    const app = await electron.launch({
      args: [mainEntry, '--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`],
      env: { ...process.env },
    });
    try {
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');
      await ensurePastFirstRun(page);

      await signInWithPIN(page, '9999');
      await expect(page.getByText('Incorrect PIN')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Welcome back')).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test('wrong password shows error', async () => {
    const userDataDir = freshUserDataDir();
    const app = await electron.launch({
      args: [mainEntry, '--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`],
      env: { ...process.env },
    });
    try {
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');
      await ensurePastFirstRun(page);

      await page.getByText('Sign in with password instead').click();
      await page.locator('#username').fill('admin');
      await page.locator('#password').fill('wrong');
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page.getByText('Incorrect username or password')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Welcome back')).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test('forced password change screen appears for default admin', async () => {
    const userDataDir = freshUserDataDir();
    const app = await electron.launch({
      args: [mainEntry, '--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`],
      env: { ...process.env },
    });
    try {
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');
      await ensurePastFirstRun(page);

      // Admin has force_password_change = true by default
      await signInAsAdmin(page);

      // Should be redirected to change password screen
      await expect(page.getByText('Change your password')).toBeVisible({ timeout: 10_000 });
    } finally {
      await app.close();
    }
  });

  test('completing password change proceeds to app', async () => {
    const userDataDir = freshUserDataDir();
    const app = await electron.launch({
      args: [mainEntry, '--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`],
      env: { ...process.env },
    });
    try {
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');
      await ensurePastFirstRun(page);
      await signInAsAdmin(page);
      await expect(page.getByText('Change your password')).toBeVisible({ timeout: 10_000 });

      // Fill and submit new password
      await page.locator('#newPassword').fill('newpassword123');
      await page.locator('#confirmPassword').fill('newpassword123');
      await page.getByRole('button', { name: 'Update password' }).click();

      // Should proceed to Dashboard/Till
      await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 15_000 });
    } finally {
      await app.close();
    }
  });
});