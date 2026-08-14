import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { expect, _electron as electron } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainEntry = path.join(__dirname, '..', 'electron', 'main.js');

export const API_BASE = 'http://127.0.0.1:8001/api';

export function freshUserDataDir() {
  const dir = path.join(os.tmpdir(), `pos-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function launchApp() {
  const userDataDir = freshUserDataDir();
  return electron.launch({
    args: [mainEntry, '--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`],
    env: { ...process.env },
  });
}

export async function ensurePastFirstRun(page) {
  const wizard = page.getByText('Welcome to Store POS');
  const login = page.getByText('Welcome back');
  await wizard.or(login).first().waitFor({ state: 'visible', timeout: 20_000 });
  if (await wizard.isVisible().catch(() => false)) {
    await page.locator('#store').fill('Test Store');
    await page.locator('input[type="password"]').fill('123456');
    await page.keyboard.press('Enter');
    await expect(login).toBeVisible({ timeout: 20_000 });
  }
}

export async function signInAsAdmin(page) {
  await page.getByText('Sign in with password instead').click();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// Run an authenticated JSON request from the page context (Bearer token is in
// localStorage, just like the app's own api client).
export async function apiJson(page, method, path, body) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const token = localStorage.getItem('pos_token');
      const res = await fetch('http://127.0.0.1:8001/api' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        /* ignore */
      }
      return { status: res.status, data };
    },
    { method, path, body }
  );
}

// Seed categories, products (incl. tracked, out-of-stock, size, modifier) and
// open a till shift so Pay is enabled.
export async function seedTillData(page) {
  await page.evaluate(async () => {
    const token = localStorage.getItem('pos_token');
    const base = 'http://127.0.0.1:8001/api';
    const post = async (path, fields) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
      const res = await fetch(base + path, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      return res.status;
    };
    const postJson = async (path, body) => {
      await fetch(base + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    };

    await postJson('/categories/category', { name: 'QA Drinks' });
    await postJson('/categories/category', { name: 'QA Food' });

    await post('/inventory/product', {
      name: 'QA Cola',
      price: '5',
      cost: '2',
      category: 'QA Drinks',
      quantity: '10',
      stock: '1',
    });
    await post('/inventory/product', {
      name: 'QA Fries',
      price: '4',
      cost: '1',
      category: 'QA Food',
      quantity: '0',
      stock: '1',
    });
    await post('/inventory/product', {
      name: 'QA Pizza',
      price: '8',
      cost: '3',
      category: 'QA Food',
      quantity: '20',
      stock: '1',
      sizes: '[{"name":"Small","price":8},{"name":"Large","price":12}]',
    });
    await post('/inventory/product', {
      name: 'QA Combo',
      price: '10',
      cost: '4',
      category: 'QA Food',
      quantity: '15',
      stock: '1',
      modifiers: '[{"name":"Extra Cheese","options":[{"name":"Yes","priceDelta":1.5}]}]',
    });

    await postJson('/shifts/open', { floatAmount: 0, till: 1 });
  });
}

export async function setupTill(page) {
  await page.waitForLoadState('domcontentloaded');
  await ensurePastFirstRun(page);
  await expect(page.getByText('Welcome back')).toBeVisible();
  await signInAsAdmin(page);
  await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });

  await seedTillData(page);

  // Reload so AppShell re-fetches the freshly seeded products/categories.
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });

  await page.getByText('Till', { exact: false }).first().click();
  await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 20_000 });
}
