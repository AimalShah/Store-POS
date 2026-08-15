import { test, expect } from '@playwright/test';
import { launchApp, setupTill, apiJson } from './helpers.mjs';

async function goSidebar(page, label) {
  // Nav items are <button>s containing the title-case label. The header also
  // has a "Dashboard" button, so .last() selects the sidebar nav (which comes
  // after the header in DOM order).
  await page.locator('button', { hasText: 'Dashboard' }).last().click();
  await expect(page.getByText("Today's Sales")).toBeVisible({ timeout: 20_000 });
  await page.locator('button', { hasText: label }).last().click();
}

async function seedSale(page, { total, ref, status = 1, shiftId }) {
  const { data: products } = await apiJson(page, 'GET', '/inventory/products');
  const id = products[0]?.id ?? 1;
  return apiJson(page, 'POST', '/new', {
    ref_number: ref,
    customer: '0',
    customer_name: 'Walk-in Customer',
    status,
    user_id: 1,
    user: 'Administrator',
    till: 1,
    shift_id: shiftId,
    discount: 0,
    subtotal: total,
    tax: 0,
    total,
    paid: total,
    change: 0,
    payment_type: 1,
    payment_breakdown: [{ method: 'cash', amount: total }],
    items: [{ id, name: 'QA Cola', price: total, quantity: 1, cost: 2 }],
    date: new Date().toISOString(),
  });
}

test('Reports: date filter narrows data and the summary reflects the range', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    const shift = (await apiJson(page, 'GET', '/shifts/open?till=1')).data;
    await seedSale(page, { total: 50, ref: 'RPT-50', shiftId: shift?.id });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await goSidebar(page, 'Reports');

    // Default range (this month) includes today's sale — report must load.
    await expect(page.getByText('Total Sales', { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Rs50.00').first()).toBeVisible({ timeout: 20_000 });

    // Now filter to a past range — the total must drop to zero.
    await page.locator('#report-from').fill('2020-01-01T00:00');
    await page.locator('#report-to').fill('2020-12-31T23:59');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('No sales in this range.').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Rs0.00').first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await app.close();
  }
});

test('Catalog: search box filters the product list', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await goSidebar(page, 'Catalog');

    await expect(page.getByText('QA Cola', { exact: false })).toBeVisible();
    await expect(page.getByText('QA Fries', { exact: false })).toBeVisible();

    await page.getByPlaceholder('Search name, category, or ID').fill('QA Cola');
    await expect(page.getByText('QA Cola', { exact: false })).toBeVisible();
    await expect(page.getByText('QA Fries', { exact: false })).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('Sales: status filter shows only matching transactions', async () => {
    const app = await launchApp();
    try {
    const page = await app.firstWindow();
    await setupTill(page);
    const shift = (await apiJson(page, 'GET', '/shifts/open?till=1')).data;
    // Seed a held (unpaid) order with a distinctive total. The transactions
    // table shows the numeric id, not the ref_number, so we assert on the total.
    await seedSale(page, { total: 15, ref: 'HOLD-TEST-123', status: 0, shiftId: shift?.id });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await goSidebar(page, 'Sales');

    // Default filter is "Paid" — the held order must be hidden.
    await expect(page.getByText('Rs15.00')).toHaveCount(0);

    // Switch status to "Unpaid / Hold" and apply. The filter selects render as
    // Radix triggers with a stable data-slot; Status is the second one.
    const statusTrigger = page.locator('[data-slot="select-trigger"]').nth(1);
    await statusTrigger.click();
    await page.getByRole('option', { name: 'Unpaid / Hold' }).click();
    await page.getByRole('button', { name: 'Filter' }).click();

    // The held order's total appears in both the Total and Paid columns, so
    // scope to .first() to avoid the strict-mode ambiguity.
    await expect(page.getByText('Rs15.00').first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await app.close();
  }
});
