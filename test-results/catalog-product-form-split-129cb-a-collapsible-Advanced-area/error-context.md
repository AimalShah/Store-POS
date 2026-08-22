# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalog.spec.mjs >> product form splits into Essentials and a collapsible Advanced area
- Location: e2e/catalog.spec.mjs:95:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Today\'s Sales')
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for getByText('Today\'s Sales')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { launchApp, setupTill } from './helpers.mjs';
  3   | 
  4   | // Drives the real front-end forms (not the API) for adding a category and a
  5   | // product through the Menu (catalog) view.
  6   | async function goToInventory(page) {
  7   |   // Switch out of Till mode via the header toggle (no confirm dialog), then
  8   |   // open Menu from the sidebar.
  9   |   await page.getByText('Dashboard', { exact: false }).first().click();
> 10  |   await expect(page.getByText("Today's Sales")).toBeVisible({ timeout: 20_000 });
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  11  |   await page.getByText('Menu', { exact: false }).first().click();
  12  |   await expect(page.getByText('New product')).toBeVisible({ timeout: 20_000 });
  13  | }
  14  | 
  15  | async function expandAdvanced(page) {
  16  |   const toggle = page.locator('button:has-text("Advanced")');
  17  |   await toggle.click();
  18  |   await expect(page.getByText('Cost per item', { exact: true })).toBeVisible({ timeout: 20_000 });
  19  | }
  20  | 
  21  | test('adds a category through the front-end form', async () => {
  22  |   const app = await launchApp();
  23  |   try {
  24  |     const page = await app.firstWindow();
  25  |     await setupTill(page);
  26  |     await page.reload();
  27  |     await page.waitForLoadState('domcontentloaded');
  28  |     await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
  29  |     await goToInventory(page);
  30  | 
  31  |     const catName = `UI Cat ${Date.now()}`;
  32  |     await page.getByRole('button', { name: 'Categories', exact: true }).click();
  33  |     await page.locator('#cat-name').fill(catName);
  34  |     await page.getByLabel('Choose section icon').click();
  35  |     await page.getByLabel('Search icons').fill('CupSoda');
  36  |     await page.getByRole('button', { name: 'Use CupSoda icon' }).click();
  37  |     // The icon popover stays open after picking — dismiss it so it doesn't
  38  |     // intercept the Add category button.
  39  |     await page.keyboard.press('Escape');
  40  |     await page.getByRole('button', { name: 'Add category' }).click();
  41  | 
  42  |     // The new category should now appear in the list.
  43  |     await expect(page.getByText(catName, { exact: false })).toBeVisible({ timeout: 20_000 });
  44  |   } finally {
  45  |     await app.close();
  46  |   }
  47  | });
  48  | 
  49  | test('adds a product through the front-end form and assigns a category', async () => {
  50  |   const app = await launchApp();
  51  |   try {
  52  |     const page = await app.firstWindow();
  53  |     await setupTill(page);
  54  |     await page.reload();
  55  |     await page.waitForLoadState('domcontentloaded');
  56  |     await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
  57  |     await goToInventory(page);
  58  | 
  59  |     const catName = `UI Cat ${Date.now()}`;
  60  |     const productName = `UI Prod ${Date.now()}`;
  61  | 
  62  |     // Create the category via the UI form.
  63  |     await page.getByRole('button', { name: 'Categories', exact: true }).click();
  64  |     await page.locator('#cat-name').fill(catName);
  65  |     await page.getByRole('button', { name: 'Add category' }).click();
  66  |     await expect(page.getByText(catName, { exact: false })).toBeVisible({ timeout: 20_000 });
  67  | 
  68  |     // Reload so the product form's category dropdown is freshly populated.
  69  |     await page.reload();
  70  |     await page.waitForLoadState('domcontentloaded');
  71  |     await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
  72  |     await goToInventory(page);
  73  | 
  74  |     // Cost lives in the collapsed Advanced area, so expand it first.
  75  |     await expandAdvanced(page);
  76  | 
  77  |     // Fill the product form essentials + cost + assigned section.
  78  |     await page.locator('#product-name').fill(productName);
  79  |     await page.locator('#product-price').fill('7.5');
  80  |     await page.locator('#product-cost').fill('3');
  81  | 
  82  |     // Select the category from the shadcn Select.
  83  |     await page.locator('#product-category').click();
  84  |     await page.getByRole('option', { name: catName }).click();
  85  | 
  86  |     await page.getByRole('button', { name: 'Add product' }).click();
  87  | 
  88  |     // The product should now be listed.
  89  |     await expect(page.getByText(productName, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  90  |   } finally {
  91  |     await app.close();
  92  |   }
  93  | });
  94  | 
  95  | test('product form splits into Essentials and a collapsible Advanced area', async () => {
  96  |   const app = await launchApp();
  97  |   try {
  98  |     const page = await app.firstWindow();
  99  |     await setupTill(page);
  100 |     await page.reload();
  101 |     await page.waitForLoadState('domcontentloaded');
  102 |     await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
  103 |     await goToInventory(page);
  104 | 
  105 |     // Essentials section and its fields are visible by default.
  106 |     await expect(page.locator('#product-name')).toBeVisible();
  107 |     await expect(page.locator('#product-price')).toBeVisible();
  108 |     await expect(page.getByText('Photo (optional)', { exact: true })).toBeVisible();
  109 |     await expect(page.getByText('Feature as daily special', { exact: true })).toBeVisible();
  110 | 
```