import { test, expect } from '@playwright/test';
import { launchApp, setupTill } from './helpers.mjs';

// Regression tests: date-range calendars on Sales and Stock. The shared
// DateRangePicker must open, stay open while a range is built across two
// clicks, apply the range, and update its label.

async function goSidebar(page, label) {
  await page.locator('button', { hasText: 'Dashboard' }).last().click();
  await expect(page.getByText("Today's Sales")).toBeVisible({ timeout: 20_000 });
  await page.locator('button', { hasText: label }).last().click();
}

async function openPickerAndPickRange(page, trigger) {
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  const beforeText = (await trigger.innerText()).trim();
  await trigger.click();

  const popup = page.locator('[data-slot="popover-content"]');
  await expect(popup).toBeVisible({ timeout: 10_000 });
  const cal = popup.locator('[data-slot="calendar"]');
  await expect(cal).toBeVisible({ timeout: 10_000 });

  // Pick a range ending today; the trigger label must switch off its old text.
  const dayButtons = popup.locator('table td button');
  const count = await dayButtons.count();
  if (count < 40) throw new Error(`expected >=40 day buttons, got ${count}`);
  await dayButtons.nth(count - 10).click();
  // Regression: the picker used to apply + close on this FIRST click
  // (react-day-picker v10 emits {from,to} on an empty selection), making
  // multi-day range selection impossible.
  await expect(dayButtons.first()).toBeVisible({ timeout: 5_000 });
  await expect(popup).toBeVisible();
  const count2 = await dayButtons.count();
  if (count2 < 40) throw new Error(`expected >=40 day buttons after start, got ${count2}`);
  await dayButtons.nth(count2 - 8).click();

  await expect(trigger).not.toHaveText(beforeText, { timeout: 10_000 });
}

test('[cal1] Sales: date range picker opens and selects a range', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await page.reload();
    await expect(page.getByText('Dashboard', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await goSidebar(page, 'Sales');
    const trigger = page
      .locator('[data-slot="popover-trigger"]')
      .filter({ hasText: /Today|–/ })
      .last();
    await openPickerAndPickRange(page, trigger);
  } finally {
    await app.close();
  }
});

test('[cal1] Stock: date range picker opens and selects a range', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await page.reload();
    await expect(page.getByText('Dashboard', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await goSidebar(page, 'Stock');
    const trigger = page
      .locator('[data-slot="popover-trigger"]')
      .filter({ hasText: /Today|–/ })
      .last();
    await openPickerAndPickRange(page, trigger);
  } finally {
    await app.close();
  }
});
