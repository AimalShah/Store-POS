import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', '..', 'screenshots');
const BASE = 'http://127.0.0.1:5173';
const PIN = '123456';

async function launch() {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];
  try {
    return await chromium.launch({ headless: true, channel: 'chrome', args });
  } catch {
    return await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args });
  }
}

const PAGES = [
  ['Dashboard', 'page-dashboard'],
  ['Sales', 'page-sales'],
  ['Reports', 'page-reports'],
  ['Shifts', 'page-shifts'],
  ['Catalog', 'page-catalog'],
  ['Stock History', 'page-stock'],
  ['Customers', 'page-customers'],
  ['Team', 'page-team'],
  ['Settings', 'page-settings'],
  ['Export', 'page-export'],
  ['Printers', 'page-printers'],
];

const run = async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const shot = async (name, full = true) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
    console.log('shot', name);
  };
  const step = async (label, fn) => {
    try { await fn(); } catch (e) { console.log(`STEP FAIL [${label}]:`, e.message); await shot(`${label}-fail`, false); }
  };

  // Login -> Dashboard
  await step('login', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await page.fill('input[type="password"]', PIN);
    await page.keyboard.press('Enter');
    await page.getByText('Where would you like to go?', { timeout: 15000 }).waitFor();
    await page.getByRole('button', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Pay' }).waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
  });

  // Every sidebar page (stay in dashboard mode)
  for (const [label, file] of PAGES) {
    await step(file, async () => {
      await page.getByRole('button', { name: label, exact: true }).first().click();
      await page.waitForTimeout(900);
      await shot(file, true);
    });
  }

  // Top-bar: account dropdown
  await step('top-account', async () => {
    await page.getByRole('button', { name: /Administrator/ }).click();
    await page.getByRole('menuitem', { name: /Sign out/i }).waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    await shot('top-account-dropdown', false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // Top-bar: search / command palette
  await step('top-search', async () => {
    await page.getByRole('button', { name: /Search/i }).click();
    await page.waitForTimeout(500);
    await shot('top-search', false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // Till with Pizzas tab
  await step('till-pizzas', async () => {
    await page.getByRole('button', { name: /New Sale/i }).click();
    await page.getByRole('button', { name: 'Pay' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Pizzas' }).first().click();
    await page.waitForTimeout(600);
    await shot('till-pizzas', false);
  });

  await browser.close();
  console.log('\nDONE');
};

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
