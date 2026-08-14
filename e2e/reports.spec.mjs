import { test, expect } from '@playwright/test';
import { launchApp, setupTill, apiJson } from './helpers.mjs';

// Seed two known paid sales through the API, then prove the Dashboard KPIs
// and the Reports view surface exactly those numbers (no manipulation).
async function seedKnownSales(page, shiftId, colaId, friesId) {
  await apiJson(page, 'POST', '/new', {
    ref_number: '',
    customer: '0',
    customer_name: 'Walk-in Customer',
    status: 1,
    user_id: 1,
    user: 'Administrator',
    till: 1,
    shift_id: shiftId,
    discount: 0,
    subtotal: 10,
    tax: 0,
    total: 10,
    paid: 10,
    change: 0,
    payment_type: 1,
    payment_breakdown: [{ method: 'cash', amount: 10 }],
    items: [{ id: colaId, name: 'QA Cola', price: 5, quantity: 2, cost: 2 }],
    date: new Date().toISOString(),
  });
  await apiJson(page, 'POST', '/new', {
    ref_number: '',
    customer: '0',
    customer_name: 'Walk-in Customer',
    status: 1,
    user_id: 1,
    user: 'Administrator',
    till: 1,
    shift_id: shiftId,
    discount: 0,
    subtotal: 9,
    tax: 0,
    total: 9,
    paid: 9,
    change: 0,
    payment_type: 2,
    payment_breakdown: [{ method: 'card', amount: 9 }],
    items: [
      { id: colaId, name: 'QA Cola', price: 5, quantity: 1, cost: 2 },
      { id: friesId, name: 'QA Fries', price: 4, quantity: 1, cost: 1 },
    ],
    date: new Date().toISOString(),
  });
}

test('Dashboard KPIs reflect the real sales totals', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    // Resolve the seeded product ids and the open shift.
    const products = (await apiJson(page, 'GET', '/inventory/products')).data || [];
    const colaId = products.find((p) => p.name === 'QA Cola')?.id;
    const friesId = products.find((p) => p.name === 'QA Fries')?.id;
    const shiftId = (await apiJson(page, 'GET', '/shifts/open?till=1')).data?.id;
    expect(colaId).toBeTruthy();
    expect(shiftId).toBeTruthy();

    // Two sales: Rs10 (cash) + Rs9 (card) = Rs19, 2 orders, profit Rs12.
    await seedKnownSales(page, shiftId, colaId, friesId);

    // Reload so the Dashboard re-fetches with the new sales.
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await page.getByText('Dashboard', { exact: false }).first().click();

    // KPI cards use data-testid="kpi-<slug>".
    await expect(page.getByTestId('kpi-today-s-sales')).toContainText('Rs19.00');
    await expect(page.getByTestId('kpi-orders')).toContainText('2');
    await expect(page.getByTestId('kpi-profit-margin')).toContainText('12.00');
  } finally {
    await app.close();
  }
});

test('Reports view shows the true aggregated totals', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    const products = (await apiJson(page, 'GET', '/inventory/products')).data || [];
    const colaId = products.find((p) => p.name === 'QA Cola')?.id;
    const friesId = products.find((p) => p.name === 'QA Fries')?.id;
    const shiftId = (await apiJson(page, 'GET', '/shifts/open?till=1')).data?.id;

    await seedKnownSales(page, shiftId, colaId, friesId);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });

    // Enter dashboard mode via the header toggle (no confirm dialog), then
    // open Reports from the sidebar.
    await page.getByText('Dashboard', { exact: false }).first().click();
    await expect(page.getByText("Today's Sales")).toBeVisible({ timeout: 20_000 });
    await page.getByText('Reports', { exact: false }).first().click();
    await expect(page.getByText('Total Sales')).toBeVisible({ timeout: 20_000 });

    // Total Sales = Rs19.00, Items Sold = 4, Sales count = 2.
    await expect(page.getByText('Rs19.00')).toBeVisible();
    await expect(page.getByText('Items Sold')).toBeVisible();
    const totals = page.locator('div').filter({ hasText: 'Total Sales' }).first();
    await expect(totals).toContainText('Rs19.00');
  } finally {
    await app.close();
  }
});
