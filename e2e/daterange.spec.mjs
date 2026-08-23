import { test, expect } from '@playwright/test';
import { launchApp, setupTill, apiJson } from './helpers.mjs';

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

  // Click 1 (in the FIRST visible month): must NOT apply or close — it drafts
  // the start. RDP v10 only emits range_start/range_end modifiers once BOTH
  // endpoints exist, so a drafted from-only day renders as selected-single.
  await dayButtons.nth(10).click();
  await expect(dayButtons.first()).toBeVisible({ timeout: 5_000 });
  await expect(popup).toBeVisible();
  await expect(popup.locator('button[data-selected-single="true"]').first()).toBeVisible();

  // Click 2 (cross-month, near the end of the SECOND month): applies the
  // range, closes the popup, and updates the trigger label.
  const count2 = await dayButtons.count();
  if (count2 < 40) throw new Error(`expected >=40 day buttons after start, got ${count2}`);
  await dayButtons.nth(count2 - 8).click();
  await expect(popup).toHaveCount(0);
  await expect(trigger).not.toHaveText(beforeText, { timeout: 10_000 });
}

async function pickSingleDayRange(page, trigger) {
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  const beforeText = (await trigger.innerText()).trim();
  await trigger.click();
  const popup = page.locator('[data-slot="popover-content"]');
  await expect(popup).toBeVisible({ timeout: 10_000 });

  const dayButtons = popup.locator('table td button');
  const count = await dayButtons.count();
  if (count < 40) throw new Error(`expected >=40 day buttons, got ${count}`);
  const idx = count - 12;
  await dayButtons.nth(idx).click();
  await expect(dayButtons.first()).toBeVisible();
  await dayButtons.nth(idx).click(); // same day twice = single-day range
  await expect(popup).toHaveCount(0);
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

test('[cal1] Sales: single-day range via double click applies', async () => {
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
    await pickSingleDayRange(page, trigger);
  } finally {
    await app.close();
  }
});

test('[cal1] Sales: picking a past range filters today\'s sale out of the table', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    const shift = (await apiJson(page, 'GET', '/shifts/open?till=1')).data;
    await apiJson(page, 'POST', '/new', {
      ref_number: 'CAL-RANGE-50',
      customer: '0',
      customer_name: 'Walk-in Customer',
      status: 1,
      user_id: 1,
      user: 'Administrator',
      till: 1,
      shift_id: shift?.id,
      discount: 0,
      subtotal: 50,
      tax: 0,
      total: 50,
      paid: 50,
      change: 0,
      payment_type: 1,
      payment_breakdown: [{ method: 'cash', amount: 50 }],
      items: [{ id: 1, name: 'QA Cola', price: 50, quantity: 1, cost: 2 }],
      date: new Date().toISOString(),
    });
    await page.reload();
    await expect(page.getByText('Dashboard', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await goSidebar(page, 'Sales');
    await expect(page.getByText('Rs50.00').first()).toBeVisible({ timeout: 20_000 });

    // Select a range that excludes today (two days early in the first month).
    const trigger = page
      .locator('[data-slot="popover-trigger"]')
      .filter({ hasText: /Today|–/ })
      .last();
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.click();
    const popup = page.locator('[data-slot="popover-content"]');
    await expect(popup).toBeVisible({ timeout: 10_000 });
    const dayButtons = popup.locator('table td button');
    const count = await dayButtons.count();
    if (count < 40) throw new Error(`expected >=40 day buttons, got ${count}`);
    await dayButtons.nth(7).click();   // ~Aug 1
    await expect(dayButtons.first()).toBeVisible({ timeout: 5_000 });
    await dayButtons.nth(11).click();  // ~Aug 6
    await expect(popup).toHaveCount(0);

    // Today's seeded sale must vanish from the filtered table.
    await expect(page.getByText('Rs50.00')).toHaveCount(0);
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
