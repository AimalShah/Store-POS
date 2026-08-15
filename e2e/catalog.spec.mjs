import { test, expect } from '@playwright/test';
import { launchApp, setupTill } from './helpers.mjs';

// Drives the real front-end forms (not the API) for adding a category and a
// product through the Menu (catalog) view.
async function goToInventory(page) {
  // Switch out of Till mode via the header toggle (no confirm dialog), then
  // open Menu from the sidebar.
  await page.getByText('Dashboard', { exact: false }).first().click();
  await expect(page.getByText("Today's Sales")).toBeVisible({ timeout: 20_000 });
  await page.getByText('Menu', { exact: false }).first().click();
  await expect(page.getByText('New product')).toBeVisible({ timeout: 20_000 });
}

async function expandAdvanced(page) {
  const toggle = page.locator('button:has-text("Advanced")');
  await toggle.click();
  await expect(page.getByText('Cost per item', { exact: true })).toBeVisible({ timeout: 20_000 });
}

test('adds a category through the front-end form', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await goToInventory(page);

    const catName = `UI Cat ${Date.now()}`;
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await page.locator('#cat-name').fill(catName);
    await page.getByLabel('Choose section icon').click();
    await page.getByLabel('Search icons').fill('CupSoda');
    await page.getByRole('button', { name: 'Use CupSoda icon' }).click();
    // The icon popover stays open after picking — dismiss it so it doesn't
    // intercept the Add category button.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add category' }).click();

    // The new category should now appear in the list.
    await expect(page.getByText(catName, { exact: false })).toBeVisible({ timeout: 20_000 });
  } finally {
    await app.close();
  }
});

test('adds a product through the front-end form and assigns a category', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await goToInventory(page);

    const catName = `UI Cat ${Date.now()}`;
    const productName = `UI Prod ${Date.now()}`;

    // Create the category via the UI form.
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await page.locator('#cat-name').fill(catName);
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByText(catName, { exact: false })).toBeVisible({ timeout: 20_000 });

    // Reload so the product form's category dropdown is freshly populated.
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await goToInventory(page);

    // Cost lives in the collapsed Advanced area, so expand it first.
    await expandAdvanced(page);

    // Fill the product form essentials + cost + assigned section.
    await page.locator('#product-name').fill(productName);
    await page.locator('#product-price').fill('7.5');
    await page.locator('#product-cost').fill('3');

    // Select the category from the shadcn Select.
    await page.locator('#product-category').click();
    await page.getByRole('option', { name: catName }).click();

    await page.getByRole('button', { name: 'Add product' }).click();

    // The product should now be listed.
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await app.close();
  }
});

test('product form splits into Essentials and a collapsible Advanced area', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await goToInventory(page);

    // Essentials section and its fields are visible by default.
    await expect(page.locator('#product-name')).toBeVisible();
    await expect(page.locator('#product-price')).toBeVisible();
    await expect(page.getByText('Photo (optional)', { exact: true })).toBeVisible();
    await expect(page.getByText('Feature as daily special', { exact: true })).toBeVisible();

    // Advanced section header is shown, but its fields are collapsed (not in the DOM).
    const advancedToggle = page.locator('button:has-text("Advanced")');
    await expect(advancedToggle).toBeVisible();
    await expect(page.getByText('Cost per item', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Track stock count', { exact: true })).toHaveCount(0);

    // Expanding reveals the Advanced fields and relabeled wording.
    await expandAdvanced(page);
    await expect(page.getByText('Track stock count', { exact: true })).toBeVisible();
    await expect(page.getByText('Low-stock alert at', { exact: true })).toHaveCount(0); // only after tracking
  } finally {
    await app.close();
  }
});

test('an item saves through the form without a photo', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await setupTill(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
    await goToInventory(page);

    const productName = `No Photo ${Date.now()}`;

    // Fill only Essentials: name, price and the "None" section. No photo picked.
    await page.locator('#product-name').fill(productName);
    await page.locator('#product-price').fill('5');
    await page.locator('#product-category').click();
    await page.getByRole('option', { name: 'None' }).click();

    await page.getByRole('button', { name: 'Add product' }).click();

    // The product appears in the list, proving it saved without a photo.
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await app.close();
  }
});
