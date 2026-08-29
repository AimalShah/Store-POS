import { test, expect } from '@playwright/test';
import { launchApp, setupTill } from './helpers.mjs';

test('topbar shows centred Till/Dashboard tabs and the date range picker in both modes', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    // In till mode: both tabs and the date range picker are visible.
    await expect(page.getByTestId('mode-tab-till')).toBeVisible();
    await expect(page.getByTestId('mode-tab-dashboard')).toBeVisible();
    await expect(page.getByRole('button', { name: /today/i })).toBeVisible();

    // Switch to Dashboard via the tab -> confirmation gate then dashboard.
    await page.getByTestId('mode-tab-dashboard').click();
    await expect(page.getByRole('alertdialog').getByText('Switch to the Dashboard?')).toBeVisible();
    await page.getByRole('button', { name: 'Switch' }).click();

    // Dashboard mode: tabs + date range picker still visible.
    await expect(page.getByTestId('mode-tab-till')).toBeVisible();
    await expect(page.getByTestId('mode-tab-dashboard')).toBeVisible();
    await expect(page.getByRole('button', { name: /today/i })).toBeVisible();

    // Switch back to Till via the tab.
    await page.getByTestId('mode-tab-till').click();
    await page.getByRole('button', { name: 'Switch' }).click();
    await expect(page.getByTestId('fulfillment-gate')).toBeVisible({ timeout: 10_000 });
  } finally {
    await app.close();
  }
});
