import { test, expect } from '@playwright/test';
import { launchApp, ensurePastFirstRun, seedTillData, apiJson } from './helpers.mjs';

async function signInAsAdmin(page) {
  const passwordInstead = page.getByText('Sign in with password instead');
  if (await passwordInstead.count()) {
    await passwordInstead.click();
  }
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function openTillAtGate(page) {
  await page.waitForLoadState('domcontentloaded');
  await ensurePastFirstRun(page);
  await expect(page.getByText('Welcome back')).toBeVisible();
  await signInAsAdmin(page);
  await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });

  await seedTillData(page);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });

  // Go to the till but STOP at the fulfillment gate (do not dismiss it).
  await page.getByText('Till', { exact: false }).first().click();
  await expect(page.getByTestId('fulfillment-gate')).toBeVisible({ timeout: 20_000 });
}

async function chooseOnGate(page, dataTestId) {
  await page.getByTestId(dataTestId).click();
}

test('a fresh order opens on the fulfillment gate and the menu hides until a pick', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await openTillAtGate(page);

    // Gate shows the intro text and 3 choice cards.
    await expect(page.getByTestId('fulfillment-gate')).toBeVisible();
    await expect(page.getByTestId('fulfillment-choice-dine-in')).toBeVisible();
    await expect(page.getByTestId('fulfillment-choice-takeaway')).toBeVisible();
    await expect(page.getByTestId('fulfillment-choice-delivery')).toBeVisible();

    // The product grid (search tab) is NOT rendered before a choice.
    await expect(page.getByTestId('cat-tab-search')).toHaveCount(0);

    // Picking a card reveals the normal menu.
    await chooseOnGate(page, 'fulfillment-choice-dine-in');
    await expect(page.getByTestId('cat-tab-search')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'QA Cola' })).toBeVisible();
    // Chip reflects the selection.
    await expect(page.getByTestId('fulfillment-chip')).toContainText('Dine-in');
  } finally {
    await app.close();
  }
});

test('choosing Delivery on the gate auto-opens the customer drawer', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await openTillAtGate(page);

    await chooseOnGate(page, 'fulfillment-choice-delivery');
    // Drawer auto-opens because no customer / one-time details are set.
    await expect(page.getByRole('heading', { name: 'Customer' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('fulfillment-chip')).toContainText('Delivery');
  } finally {
    await app.close();
  }
});

test('a completed sale returns to the gate (no stale fulfillment)', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await openTillAtGate(page);
    await chooseOnGate(page, 'fulfillment-choice-takeaway');
    await expect(page.getByTestId('cat-tab-search')).toBeVisible();

    // Add a product and complete a cash sale.
    await page.getByRole('button', { name: 'QA Cola' }).click();
    await page.getByRole('button', { name: 'Pay' }).click();
    await expect(page.getByRole('dialog').getByText('Checkout')).toBeVisible();
    await page.getByRole('button', { name: 'Cash', exact: false }).click();
    await page.getByTestId('pay-amount').fill('5');
    await page.getByRole('button', { name: 'Add', exact: false }).click();
    await page.getByTestId('pay-now').click();
    await expect(page.getByText('Sale Complete & Receipt')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();

    // A fresh order starts back at the gate.
    await expect(page.getByTestId('fulfillment-gate')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('cat-tab-search')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('clearing the cart returns to the gate', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await openTillAtGate(page);
    await chooseOnGate(page, 'fulfillment-choice-takeaway');

    await page.getByRole('button', { name: 'QA Cola' }).click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByTestId('fulfillment-gate')).toBeVisible({ timeout: 10_000 });
  } finally {
    await app.close();
  }
});

test('restoring a held order bypasses the gate and uses its saved fulfillment', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await openTillAtGate(page);
    await chooseOnGate(page, 'fulfillment-choice-dine-in');

    await page.getByRole('button', { name: 'QA Cola' }).click();
    await page.getByRole('button', { name: 'Hold' }).click();

    // Holding returns to the gate for a fresh order.
    await expect(page.getByTestId('fulfillment-gate')).toBeVisible({ timeout: 10_000 });

    // Resume the held order -> straight into the menu with its fulfillment.
    await page.getByRole('button', { name: 'Held' }).click();
    await expect(page.getByRole('dialog').getByText('Held Orders')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByTestId('cat-tab-search')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('fulfillment-chip')).toContainText('Dine-in');
  } finally {
    await app.close();
  }
});
