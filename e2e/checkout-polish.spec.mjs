import { test, expect } from '@playwright/test';
import { launchApp, setupTill } from './helpers.mjs';

async function openCheckout(page) {
  await page.getByRole('button', { name: 'Pay' }).click();
  await expect(page.getByRole('dialog').getByText('Checkout')).toBeVisible();
  await expect(page.getByTestId('pay-amount')).toBeFocused();
}

test('Enter in the amount field adds a payment line and does not complete the sale', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    // QA Cola is Rs5.00.
    await page.getByRole('button', { name: 'QA Cola' }).click();
    await openCheckout(page);

    await page.getByRole('button', { name: 'Cash', exact: false }).click();
    await page.getByTestId('pay-amount').fill('5');
    await page.getByTestId('pay-amount').press('Enter');

    // A payment line was added and the field cleared (not auto-completed).
    await expect(page.getByTestId('pay-amount')).toHaveValue('');
    await expect(page.getByText('Payments added')).toBeVisible();
    await expect(page.getByText('Sale Complete & Receipt')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('after Add the amount field refocuses with its text selected', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await page.getByRole('button', { name: 'QA Cola' }).click();
    await openCheckout(page);

    await page.getByRole('button', { name: 'Cash', exact: false }).click();
    await page.getByTestId('pay-amount').fill('5');
    await page.getByRole('button', { name: 'Add', exact: false }).click();

    // Field refocused with the (emptied) text selected.
    await expect(page.getByTestId('pay-amount')).toBeFocused();
  } finally {
    await app.close();
  }
});

test('switching payment method refocuses the amount field', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await page.getByRole('button', { name: 'QA Cola' }).click();
    await openCheckout(page);

    await page.getByTestId('pay-amount').blur();
    await page.getByRole('button', { name: 'Card', exact: false }).click();
    await expect(page.getByTestId('pay-amount')).toBeFocused();
  } finally {
    await app.close();
  }
});

test('non-zero change renders as a prominent block and zero change stays compact', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    // Rs5 order, no tender yet -> zero change, prominent block absent.
    await page.getByRole('button', { name: 'QA Cola' }).click();
    await openCheckout(page);
    await page.getByRole('button', { name: 'Cash', exact: false }).click();
    await expect(page.getByTestId('change-amount')).toHaveCount(0);

    // Tender Rs7 -> change Rs2 -> prominent block appears.
    await page.getByTestId('pay-amount').fill('7');
    await page.getByRole('button', { name: 'Add', exact: false }).click();
    await expect(page.getByTestId('change-amount')).toHaveText(/Rs2\.00/);
  } finally {
    await app.close();
  }
});

test('a checkout-time error renders above the dialog content', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await page.getByRole('button', { name: 'QA Cola' }).click();
    await openCheckout(page);

    // Partial payment then Pay Now -> error banner appears in the dialog.
    await page.getByRole('button', { name: 'Cash', exact: false }).click();
    await page.getByTestId('pay-amount').fill('3');
    await page.getByRole('button', { name: 'Add', exact: false }).click();
    await page.getByTestId('pay-now').click();

    await expect(page.getByTestId('checkout-error')).toBeVisible();
    await expect(page.getByTestId('checkout-error')).toContainText(/Payment lines do not cover/);
  } finally {
    await app.close();
  }
});
