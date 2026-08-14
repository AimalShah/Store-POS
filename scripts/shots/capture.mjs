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
    return await chromium.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome',
      args,
    });
  }
}

const run = async () => {
  const browser = await launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
    console.log('shot', name);
  };
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      console.log(`STEP FAIL [${label}]:`, e.message);
      await shot(`${label}-fail`);
    }
  };

  // 1. Login
  await step('01-login', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await shot('01-login');
    await page.fill('input[type="password"]', PIN);
    await page.keyboard.press('Enter');
    await page.getByText('Where would you like to go?', { timeout: 15000 }).waitFor();
    await shot('02-landing');
  });

  // 2. Dashboard
  await step('03-dashboard', async () => {
    await page.getByRole('button', { name: 'Dashboard' }).click();
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });
    await page.waitForTimeout(800);
    await shot('03-dashboard');
  });

  // 3. Till (via New Sale)
  await step('04-till', async () => {
    await page.getByRole('button', { name: /New Sale/i }).click();
    await page.getByRole('button', { name: 'Pay' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    await shot('04-till');
  });

  // 4. Open a product (variant popup)
  await step('05-variant', async () => {
    await page.getByRole('button', { name: 'Pizzas' }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Margherita' }).first().click();
    await page.getByText(/choose one/i, { timeout: 8000 }).waitFor();
    await shot('05-variant-popup');
    await page.getByRole('button', { name: /Small|Medium|Large/ }).first().click();
    await page.getByRole('button', { name: /^Add/ }).click();
    await page.waitForTimeout(600);
    await shot('06-cart');
  });

  // 5. Checkout
  await step('07-checkout', async () => {
    await page.getByRole('button', { name: 'Pay' }).click();
    await page.getByText('Checkout', { timeout: 8000 }).waitFor();
    await page.waitForTimeout(500);
    await shot('07-checkout');
  });

  // 6. Complete sale -> receipt
  await step('08-receipt', async () => {
    await page.getByRole('button', { name: /Exact/i }).click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Pay Now' }).click();
    await page.getByText(/Sale Complete & Receipt/i, { timeout: 8000 }).waitFor();
    await page.waitForTimeout(500);
    await shot('08-receipt');
  });

  // 7. Settings (theme presets)
  await step('09-settings', async () => {
    await page.getByRole('button', { name: 'Close' }).first().click();
    await page.waitForTimeout(400);
    // Dashboard via top-bar mode switcher
    await page.getByRole('button', { name: /Till/ }).first().click();
    await page.getByRole('menuitem', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Switch' }).click().catch(() => {});
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(800);
    await shot('09-settings');
  });

  await browser.close();

  if (errors.length) {
    console.log('\n--- page errors ---');
    console.log(errors.slice(0, 20).join('\n'));
  }
  console.log('\nDONE');
};

run().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
