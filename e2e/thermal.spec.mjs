import { test, expect } from '@playwright/test';
import net from 'net';
import { launchApp, setupTill, apiJson, signInAsAdmin } from './helpers.mjs';

// Full-stack thermal printer coverage WITHOUT hardware: a mock ESC/POS printer
// listens on localhost (like a real network thermal printer on port 9100), the
// app is configured to use it, and a real till sale must produce the raw
// ESC/POS byte stream — init commands, receipt text, and a paper cut.

function startMockPrinter() {
  const chunks = [];
  const server = net.createServer((socket) => {
    socket.on('data', (d) => chunks.push(d));
  });
  const started = new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
  return {
    port: started,
    async waitForBytes(timeout = 8000) {
      const start = Date.now();
      while (chunks.length === 0 && Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return Buffer.concat(chunks);
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const FULL_CUT = Buffer.from([0x1d, 0x56, 0x00]); // GS V 0
const HW_INIT = Buffer.from([0x1b, 0x40]); // ESC @

async function addProduct(page, name) {
  await page.getByRole('button', { name, exact: false }).first().click();
}

// Re-enter the till so TillView re-fetches the printer settings we configured.
// On reload the auth restore occasionally fails to re-fetch the user (a race
// that clears the session), landing on the login screen — sign back in if so.
async function openTill(page) {
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const login = page.getByText('Welcome back');
  const dashboard = page.getByText('Dashboard', { exact: false });
  await login.or(dashboard).first().waitFor({ state: 'visible', timeout: 20_000 });
  if (await login.isVisible().catch(() => false)) {
    await signInAsAdmin(page);
    await expect(dashboard).toBeVisible({ timeout: 20_000 });
  }
  await page.getByText('Till', { exact: false }).first().click();
  await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 20_000 });
}

// Complete the checkout and leave the "Sale Complete & Receipt" dialog open.
async function pay(page) {
  await page.getByRole('button', { name: 'Pay' }).click();
  await expect(page.getByRole('dialog').getByText('Checkout')).toBeVisible();
  await page.getByRole('button', { name: 'Cash', exact: false }).click();
  await page.getByTestId('pay-amount').fill('5');
  await page.getByRole('button', { name: 'Add', exact: false }).click();
  await expect(page.getByTestId('pay-now')).toBeEnabled();
  await page.getByTestId('pay-now').click();
  await expect(page.getByText('Sale Complete & Receipt')).toBeVisible({ timeout: 15_000 });
}

test('a till sale prints a real ESC/POS receipt to a network thermal printer', async () => {
  const receiptPrinter = startMockPrinter();
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    const res = await apiJson(page, 'POST', '/printer/settings', {
      interface: 'network',
      networkHost: '127.0.0.1',
      networkPort: await receiptPrinter.port,
      width: 58,
    });
    expect(res.status).toBe(200);

    await openTill(page);
    await addProduct(page, 'QA Cola');
    await pay(page);

    await page.getByRole('dialog').getByRole('button', { name: 'Print', exact: true }).click();

    const buf = await receiptPrinter.waitForBytes();
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x1b); // ESC/POS command byte
    const text = buf.toString('latin1');
    expect(text).toContain('Test Store');
    expect(text).toContain('ORDER #');
    expect(text).toContain('QA Cola');
    expect(text).toContain('TOTAL');
    expect(buf.subarray(-5, -2).equals(FULL_CUT)).toBe(true);
    expect(buf.subarray(-2).equals(HW_INIT)).toBe(true);

    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
  } finally {
    await app.close();
    await receiptPrinter.close();
  }
});

test('a takeaway sale auto-prints the kitchen ticket (KOT) to its own printer', async () => {
  const receiptPrinter = startMockPrinter();
  const kotPrinter = startMockPrinter();
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    const res = await apiJson(page, 'POST', '/printer/settings', {
      interface: 'network',
      networkHost: '127.0.0.1',
      networkPort: await receiptPrinter.port,
      width: 58,
      kotInterface: 'network',
      kotNetworkHost: '127.0.0.1',
      kotNetworkPort: await kotPrinter.port,
      kotWidth: 58,
      autoPrintKot: true,
    });
    expect(res.status).toBe(200);

    await openTill(page);
    await addProduct(page, 'QA Cola');
    await pay(page);

    // KOT is sent automatically when the sale completes (takeaway default).
    const kotBuf = await kotPrinter.waitForBytes();
    expect(kotBuf.length).toBeGreaterThan(0);
    const kotText = kotBuf.toString('latin1');
    expect(kotText).toContain('KITCHEN ORDER');
    expect(kotText).toContain('QA Cola');
    expect(kotBuf.subarray(-5, -2).equals(FULL_CUT)).toBe(true);

    // No receipt bytes yet — the receipt prints on demand from the dialog.
    await page.getByRole('dialog').getByRole('button', { name: 'Print', exact: true }).click();
    const receiptBuf = await receiptPrinter.waitForBytes();
    expect(receiptBuf.length).toBeGreaterThan(0);
    expect(receiptBuf.toString('latin1')).toContain('ORDER #');

    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
  } finally {
    await app.close();
    await receiptPrinter.close();
    await kotPrinter.close();
  }
});
