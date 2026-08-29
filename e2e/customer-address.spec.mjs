import { test, expect } from '@playwright/test';
import { launchApp, setupTill, apiJson } from './helpers.mjs';

test('new customers created from the till keep their address', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    // Open the customer drawer -> New tab.
    await page.getByTestId('customer-chip').click();
    await page.getByRole('tab', { name: 'New' }).click();

    const name = `QA Till Cust ${Date.now()}`;
    await page.getByPlaceholder('Name', { exact: true }).fill(name);
    await page.getByPlaceholder('Phone', { exact: true }).fill('0300 1234567');
    await page.getByPlaceholder('Address', { exact: true }).fill('123 Main Road, Lahore');
    await page.getByRole('button', { name: 'Save & attach' }).click();

    // The drawer closes and the order now carries the new customer.
    await expect(page.getByPlaceholder('Customer name')).toHaveCount(0);
    await expect(page.getByTestId('customer-chip')).toContainText(name);

    // The customer was persisted to the book WITH the address.
    const res = await apiJson(page, 'GET', '/customers/all');
    const saved = (res.data || []).find((c) => c.name === name);
    expect(saved).toBeTruthy();
    expect(saved.address).toBe('123 Main Road, Lahore');

    // Reopen the drawer's New tab: the form should have cleared.
    await page.getByTestId('customer-chip').click();
    await page.getByRole('tab', { name: 'New' }).click();
    await expect(page.getByPlaceholder('Address', { exact: true })).toHaveValue('');
    await expect(page.getByPlaceholder('Name', { exact: true })).toHaveValue('');
  } finally {
    await app.close();
  }
});
