import { test, expect } from '@playwright/test';
import { launchApp, setupTill, apiJson } from './helpers.mjs';

// Helper: click a product tile in the menu grid by its display name.
async function addProduct(page, name) {
  await page.getByRole('button', { name, exact: false }).first().click();
}

// Helper: complete the checkout dialog with the given payment lines and return
// once the "Sale Complete" receipt dialog is shown.
async function pay(page, lines) {
  await page.getByRole('button', { name: 'Pay' }).click();
  await expect(page.getByRole('dialog').getByText('Checkout')).toBeVisible();

  for (const line of lines) {
    await page.getByRole('button', { name: line.method, exact: false }).click();
    await page.getByTestId('pay-amount').fill(String(line.amount));
    await page.getByRole('button', { name: 'Add', exact: false }).click();
  }

  await expect(page.getByTestId('pay-now')).toBeEnabled();
  await page.getByTestId('pay-now').click();
  await expect(page.getByText('Sale Complete & Receipt')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
}

test('category tabs and search filter the product grid', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    // All products visible by default.
    await expect(page.getByRole('button', { name: 'QA Cola' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'QA Fries' })).toBeVisible();

    // Switch to the Drinks tab -> only drinks shown.
    await page.getByTestId('cat-tab-QA Drinks').click();
    await expect(page.getByRole('button', { name: 'QA Cola' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'QA Fries' })).toHaveCount(0);

    // Switch to the Food tab -> only food shown.
    await page.getByTestId('cat-tab-QA Food').click();
    await expect(page.getByRole('button', { name: 'QA Fries' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'QA Cola' })).toHaveCount(0);

    // Search tab filters the grid live as you type.
    await page.getByTestId('cat-tab-search').click();
    await page.getByPlaceholder('search all items — Enter to add').fill('Cola');
    await expect(page.getByRole('button', { name: 'QA Cola' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'QA Fries' })).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('adding a product to the cart updates totals and quantity', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await addProduct(page, 'QA Cola');
        await expect(page.getByTestId('cart-subtotal')).toHaveText(/Rs5\.00/);
    await expect(page.getByTestId('cart-total')).toHaveText(/Rs5\.00/);

    // Increase quantity -> total doubles.
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(page.getByTestId('cart-total')).toHaveText(/Rs10\.00/);

    // Decrease back.
    await page.getByRole('button', { name: 'Decrease quantity' }).click();
    await expect(page.getByTestId('cart-total')).toHaveText(/Rs5\.00/);

    // Remove the line -> cart empty.
    await page.getByRole('button', { name: 'Remove item' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('out-of-stock products cannot be added', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    const fries = page.getByRole('button', { name: 'QA Fries' });
    await expect(fries).toBeDisabled();
    await fries.click({ force: true });
    await expect(page.getByText('Cart is empty')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('products with sizes open the variant picker', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await addProduct(page, 'QA Pizza');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Large' }).click();
    await dialog.getByRole('button', { name: /Add/ }).click();

        // The chosen size appears as a variant chip on the cart line.
    await expect(page.getByText('Large')).toBeVisible();
    // Large size is Rs12, so the cart total reflects the size price.
    await expect(page.getByTestId('cart-total')).toHaveText(/Rs12\.00/);
  } finally {
    await app.close();
  }
});

test('products with modifiers add the modifier and its price', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await addProduct(page, 'QA Combo');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Yes' }).click();
    await dialog.getByRole('button', { name: /Add/ }).click();

    await expect(page.getByText('+ Yes')).toBeVisible();
    // Combo Rs10 + Extra Cheese (option "Yes") Rs1.50 = Rs11.50
    await expect(page.getByTestId('cart-total')).toHaveText(/Rs11\.50/);
  } finally {
    await app.close();
  }
});

test('fulfillment can be switched and delivery captures address', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    // Default is takeaway (the Base UI select shows the raw value).
    await expect(page.getByTestId('fulfillment-trigger')).toContainText('takeaway');

    await page.getByTestId('fulfillment-trigger').click();
    await page.getByRole('option', { name: 'Dine-in' }).click();
    await expect(page.getByTestId('fulfillment-trigger')).toContainText('dine-in');

    await page.getByTestId('fulfillment-trigger').click();
    await page.getByRole('option', { name: 'Delivery' }).click();
    await expect(page.getByTestId('fulfillment-trigger')).toContainText('delivery');
    await expect(page.getByPlaceholder('Customer name')).toBeVisible();
    await expect(page.getByPlaceholder('Contact number')).toBeVisible();
    await expect(page.getByPlaceholder('Delivery address')).toBeVisible();

    await page.getByTestId('fulfillment-trigger').click();
    await page.getByRole('option', { name: 'Takeaway' }).click();
  } finally {
    await app.close();
  }
});

test('order discount reduces the total', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await addProduct(page, 'QA Cola'); // Rs5.00
    await page.getByTestId('order-discount').fill('1');
    await expect(page.getByTestId('cart-total')).toHaveText(/Rs4\.00/);
  } finally {
    await app.close();
  }
});

test('holding an order clears the cart and the order appears in held orders', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await addProduct(page, 'QA Cola');
    await page.getByRole('button', { name: 'Hold' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible();

    await page.getByRole('button', { name: 'Held' }).click();
    await expect(page.getByText('Held Orders')).toBeVisible();
    // The held row shows the order total (Rs5.00), not the product name.
    await expect(page.getByRole('dialog').getByText(/Rs5\.00/)).toBeVisible();

    // Discard it.
    await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('dialog').getByText('No held orders found.')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('held orders can be resumed and paid with cash change, deducting stock', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await addProduct(page, 'QA Cola'); // Rs5.00, stock starts at 10
    await page.getByRole('button', { name: 'Hold' }).click();

    await page.getByRole('button', { name: 'Held' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByTestId('cart-total')).toHaveText(/Rs5\.00/);

    await pay(page, [{ method: 'Cash', amount: 7 }]); // tendered 7, change 2
    await expect(page.getByText('Cart is empty')).toBeVisible();

    // Stock should have dropped from 10 to 9.
    const res = await apiJson(page, 'GET', '/inventory/products');
    const cola = (res.data || []).find((p) => p.name === 'QA Cola');
    expect(cola?.quantity).toBe(9);
  } finally {
    await app.close();
  }
});

test('card payment completes the sale', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await addProduct(page, 'QA Cola');
    await pay(page, [{ method: 'Card', amount: 5 }]);
    await expect(page.getByText('Cart is empty')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('mobile wallet payment completes the sale', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await addProduct(page, 'QA Cola');
    await pay(page, [{ method: 'Mobile Wallet', amount: 5 }]);
    await expect(page.getByText('Cart is empty')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('split payment across cash and card completes the sale', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await addProduct(page, 'QA Cola');
    await addProduct(page, 'QA Cola'); // total Rs10.00
    await pay(page, [
      { method: 'Cash', amount: 6 },
      { method: 'Card', amount: 4 },
    ]);
    await expect(page.getByText('Cart is empty')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('Pay Now is disabled until the amount tendered covers the order', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await addProduct(page, 'QA Cola');

    await page.getByRole('button', { name: 'Pay' }).click();
    await expect(page.getByRole('dialog').getByText('Checkout')).toBeVisible();
    // With no payment line entered, Pay Now is blocked.
    await expect(page.getByTestId('pay-now')).toBeDisabled();

    // A part-payment line still leaves a balance, so completing shows an error
    // and the order is NOT completed.
    await page.getByRole('button', { name: 'Cash', exact: false }).click();
    await page.getByTestId('pay-amount').fill('3');
    await page.getByRole('button', { name: 'Add', exact: false }).click();
    await expect(page.getByTestId('pay-now')).toBeEnabled();
    await page.getByTestId('pay-now').click();
    await expect(page.getByText('Payment lines do not cover full order amount')).toBeVisible();
    await expect(page.getByTestId('cart-total')).toHaveText(/Rs5\.00/);

    // Cover the rest -> completing succeeds (invoice appears).
    await page.getByRole('button', { name: 'Card', exact: false }).click();
    await page.getByTestId('pay-amount').fill('2');
    await page.getByRole('button', { name: 'Add', exact: false }).click();
    await page.getByTestId('pay-now').click();
    await expect(page.getByText('Sale Complete & Receipt')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
  } finally {
    await app.close();
  }
});

test('empty cart cannot checkout', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    // Cart is empty by default after setupTill
    await expect(page.getByText('Cart is empty')).toBeVisible();

    await page.getByRole('button', { name: 'Pay' }).click();
    // Pay button is disabled when cart is empty
    await expect(page.getByRole('button', { name: 'Pay' })).toBeDisabled();
  } finally {
    await app.close();
  }
});

test('void flow: void a transaction, verify stock restored', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    // Make a sale: QA Cola stock starts at 10
    await addProduct(page, 'QA Cola');
    await pay(page, [{ method: 'Cash', amount: 5 }]);
    await expect(page.getByText('Cart is empty')).toBeVisible();

    // Stock should be 9 now
    let res = await apiJson(page, 'GET', '/inventory/products');
    let cola = (res.data || []).find((p) => p.name === 'QA Cola');
    expect(cola?.quantity).toBe(9);

    // Get the transaction ID from sales history
    await page.getByText('Sales', { exact: false }).first().click();
    await expect(page.getByText('Transaction History')).toBeVisible({ timeout: 10_000 });
    const firstRow = page.getByRole('row').nth(1); // header is nth(0)
    await firstRow.getByRole('button', { name: 'Void' }).click();
    await expect(page.getByText('Void this order?')).toBeVisible();
    await page.getByRole('button', { name: 'Void' }).click();

    // Stock should be restored to 10
    res = await apiJson(page, 'GET', '/inventory/products');
    cola = (res.data || []).find((p) => p.name === 'QA Cola');
    expect(cola?.quantity).toBe(10);
  } finally {
    await app.close();
  }
});

test('held orders can be discarded', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);

    await addProduct(page, 'QA Cola');
    await page.getByRole('button', { name: 'Hold' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible();

    await page.getByRole('button', { name: 'Held' }).click();
    await expect(page.getByRole('dialog').getByText('Held Orders')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('dialog').getByText('No held orders found.')).toBeVisible();
  } finally {
    await app.close();
  }
});
