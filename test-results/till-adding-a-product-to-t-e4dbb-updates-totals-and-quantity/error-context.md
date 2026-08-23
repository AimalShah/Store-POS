# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: till.spec.mjs >> adding a product to the cart updates totals and quantity
- Location: e2e/till.spec.mjs:57:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Dashboard')
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for getByText('Dashboard')

```

```yaml
- text: Store POS
- heading "The till that keeps up with the rush." [level=1]
- paragraph: Fast PIN checkout, live kitchen tickets, and daily reports — everything your counter needs in one register.
- list:
  - listitem: Lightning-fast PIN sign-in
  - listitem: Live kitchen tickets
  - listitem: Clear daily sales reports
- text: © 2026 Store POS · Secure local register Welcome back Admin sign in with your password Username
- textbox "Username": admin
- text: Password
- textbox "Password": admin
- paragraph: Too many login attempts. Please try again later.
- button "Sign in"
- button "Use the team PIN board instead"
```

# Test source

```ts
  46  | // localStorage, just like the app's own api client).
  47  | export async function apiJson(page, method, path, body) {
  48  |   return page.evaluate(
  49  |     async ({ method, path, body }) => {
  50  |       const token = localStorage.getItem('pos_token');
  51  |       const res = await fetch('http://127.0.0.1:8001/api' + path, {
  52  |         method,
  53  |         headers: {
  54  |           'Content-Type': 'application/json',
  55  |           ...(token ? { Authorization: `Bearer ${token}` } : {}),
  56  |         },
  57  |         body: body !== undefined ? JSON.stringify(body) : undefined,
  58  |       });
  59  |       const text = await res.text();
  60  |       let data = null;
  61  |       try {
  62  |         data = text ? JSON.parse(text) : null;
  63  |       } catch {
  64  |         /* ignore */
  65  |       }
  66  |       return { status: res.status, data };
  67  |     },
  68  |     { method, path, body }
  69  |   );
  70  | }
  71  | 
  72  | // Seed categories, products (incl. tracked, out-of-stock, size, modifier) and
  73  | // open a till shift so Pay is enabled.
  74  | export async function seedTillData(page) {
  75  |   await page.evaluate(async () => {
  76  |     const token = localStorage.getItem('pos_token');
  77  |     const base = 'http://127.0.0.1:8001/api';
  78  |     const post = async (path, fields) => {
  79  |       const fd = new FormData();
  80  |       for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  81  |       const res = await fetch(base + path, {
  82  |         method: 'POST',
  83  |         headers: token ? { Authorization: `Bearer ${token}` } : {},
  84  |         body: fd,
  85  |       });
  86  |       return res.status;
  87  |     };
  88  |     const postJson = async (path, body) => {
  89  |       await fetch(base + path, {
  90  |         method: 'POST',
  91  |         headers: {
  92  |           'Content-Type': 'application/json',
  93  |           ...(token ? { Authorization: `Bearer ${token}` } : {}),
  94  |         },
  95  |         body: JSON.stringify(body),
  96  |       });
  97  |     };
  98  | 
  99  |     await postJson('/categories/category', { name: 'QA Drinks' });
  100 |     await postJson('/categories/category', { name: 'QA Food' });
  101 | 
  102 |     await post('/inventory/product', {
  103 |       name: 'QA Cola',
  104 |       price: '5',
  105 |       cost: '2',
  106 |       category: 'QA Drinks',
  107 |       quantity: '10',
  108 |       stock: '1',
  109 |     });
  110 |     await post('/inventory/product', {
  111 |       name: 'QA Fries',
  112 |       price: '4',
  113 |       cost: '1',
  114 |       category: 'QA Food',
  115 |       quantity: '0',
  116 |       stock: '1',
  117 |     });
  118 |     await post('/inventory/product', {
  119 |       name: 'QA Pizza',
  120 |       price: '8',
  121 |       cost: '3',
  122 |       category: 'QA Food',
  123 |       quantity: '20',
  124 |       stock: '1',
  125 |       sizes: '[{"name":"Small","price":8},{"name":"Large","price":12}]',
  126 |     });
  127 |     await post('/inventory/product', {
  128 |       name: 'QA Combo',
  129 |       price: '10',
  130 |       cost: '4',
  131 |       category: 'QA Food',
  132 |       quantity: '15',
  133 |       stock: '1',
  134 |       modifiers: '[{"name":"Extra Cheese","options":[{"name":"Yes","priceDelta":1.5}]}]',
  135 |     });
  136 | 
  137 |     await postJson('/shifts/open', { floatAmount: 0, till: 1 });
  138 |   });
  139 | }
  140 | 
  141 | export async function setupTill(page) {
  142 |   await page.waitForLoadState('domcontentloaded');
  143 |   await ensurePastFirstRun(page);
  144 |   await expect(page.getByText('Welcome back')).toBeVisible();
  145 |   await signInAsAdmin(page);
> 146 |   await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  147 | 
  148 |   await seedTillData(page);
  149 | 
  150 |   // Reload so AppShell re-fetches the freshly seeded products/categories.
  151 |   await page.reload();
  152 |   await page.waitForLoadState('domcontentloaded');
  153 |   await expect(page.getByText('Dashboard', { exact: false })).toBeVisible({ timeout: 20_000 });
  154 | 
  155 |   await page.getByText('Till', { exact: false }).first().click();
  156 |   await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 20_000 });
  157 | }
  158 | 
```