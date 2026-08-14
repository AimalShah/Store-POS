import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';

function coerce(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

// --------------------------------------------------------------------------
// Auth / login
// --------------------------------------------------------------------------
Given('I am logged in as an admin', async function () {
  const res = await this.login('admin', 'admin');
  assert.ok(res.data?.token, 'admin login should return a token');
});

Given('I log in as an admin', async function () {
  await this.login('admin', 'admin');
});

When('I log in with username {string} and password {string}', async function (username, password) {
  await this.login(username, password);
});

When('I log in with PIN {string}', async function (pin) {
  await this.loginPin(pin);
});

Given('I log in as a cashier with PIN {string} and no product permission', async function (pin) {
  await this.login('admin', 'admin');
  await this.createCashier({ username: 'cashier_' + pin, pin, fullname: 'Cashier' });
  await this.loginPin(pin);
});

Given('I log in as a cashier with permissions {string}', async function (permCsv) {
  await this.login('admin', 'admin');
  const perms = {};
  for (const name of permCsv.split(',').map((s) => s.trim())) perms[name] = 1;
  const pin = '2' + Math.floor(Math.random() * 1000);
  await this.createCashier({ username: 'cashier_' + pin, pin, ...perms });
  await this.loginPin(pin);
});

// --------------------------------------------------------------------------
// Generic HTTP
// --------------------------------------------------------------------------
When('I send a {word} request to {string}', async function (method, path) {
  await this.send(method, path);
});

When('I send a {word} request to {string} with body:', async function (method, path, docString) {
  await this.send(method, path, docString);
});

When(
  'I send a {word} request to {string} with form:',
  async function (method, path, dataTable) {
    await this.sendForm(method, path, dataTable.rowsHash());
  }
);

When('I send a {word} request to {string} without authentication', async function (method, path) {
  const saved = this.api.token;
  this.api.token = null;
  await this.send(method, path);
  this.api.token = saved;
});

// --------------------------------------------------------------------------
// Entity factories
// --------------------------------------------------------------------------
When('I create a product with form:', async function (dataTable) {
  const fields = dataTable.rowsHash();
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v.startsWith('[') || v.startsWith('{')) {
      fd.append(k, v.replace(/\{\{(\w+)\}\}/g, (_, key) => this.store[key] ?? v)); // JSON field
    } else {
      fd.append(k, String(v));
    }
  }
  if (!fd.has('id')) fd.append('id', '');
  if (!fd.has('img')) fd.append('img', '');
  const res = await this.api.request('/api/inventory/product', { method: 'POST', body: fd });
  this.setLast(res);
  if (res.data?.id) {
    this.store.productId = res.data.id;
    this.store.productIds = this.store.productIds || [];
    this.store.productIds.push(res.data.id);
  }
});

Given('I remember the created product id as {string}', function (key) {
  this.store[key] = this.store.productId;
});

When('I update the created product with form:', async function (dataTable) {
  const fields = dataTable.rowsHash();
  const fd = new FormData();
  fd.append('id', String(this.store.productId));
  for (const [k, v] of Object.entries(fields)) {
    if (v.startsWith('[') || v.startsWith('{')) {
      fd.append(k, v.replace(/\{\{(\w+)\}\}/g, (_, key) => this.store[key] ?? v));
    } else {
      fd.append(k, String(v));
    }
  }
  if (!fd.has('img')) fd.append('img', '');
  const res = await this.api.request('/api/inventory/product', { method: 'POST', body: fd });
  this.setLast(res);
});

When('I mark the created product hot', async function () {
  const res = await this.api.request(`/api/inventory/product/${this.store.productId}/hot`, {
    method: 'POST',
    body: JSON.stringify({ hot: true }),
  });
  this.setLast(res);
});

When('I delete the created product', async function () {
  const res = await this.api.request(`/api/inventory/product/${this.store.productId}`, {
    method: 'DELETE',
  });
  this.setLast(res);
});

When('I create a category named {string}', async function (name) {
  const res = await this.createCategory(name);
  if (this.last?.data !== undefined) this.store.categoryId = this.last?.data ?? this.store.categoryId;
  // categories route returns 200 with no body; resolve id from the list
  const list = await this.api.request('/api/categories/all');
  const created = (list.data || []).find((c) => c.name === name);
  if (created) this.store.categoryId = created.id;
  this.setLast(res);
});

When('I rename the created category to {string}', async function (name) {
  const res = await this.api.request('/api/categories/category', {
    method: 'PUT',
    body: JSON.stringify({ id: this.store.categoryId, name }),
  });
  this.setLast(res);
});

When('I delete the created category', async function () {
  const res = await this.api.request(`/api/categories/category/${this.store.categoryId}`, {
    method: 'DELETE',
  });
  this.setLast(res);
});

When('I fetch the category list', async function () {
  const res = await this.api.request('/api/categories/all');
  this.setLast(res);
});

When('I create a customer named {string} with phone {string}', async function (name, phone) {
  const res = await this.createCustomer({ name, phone });
  const list = await this.api.request('/api/customers/all');
  const created = (list.data || []).find((c) => c.name === name);
  if (created) this.store.customerId = created.id;
  this.setLast(res);
});

When('I update the created customer name to {string}', async function (name) {
  const res = await this.api.request('/api/customers/customer', {
    method: 'PUT',
    body: JSON.stringify({ _id: this.store.customerId, name, phone: '000', email: '', address: '' }),
  });
  this.setLast(res);
});

When('I delete the created customer', async function () {
  const res = await this.api.request(`/api/customers/customer/${this.store.customerId}`, {
    method: 'DELETE',
  });
  this.setLast(res);
});

When('I fetch the created customer', async function () {
  const res = await this.api.request(`/api/customers/customer/${this.store.customerId}`);
  this.setLast(res);
});

When('I open a shift with float {float}', async function (floatAmount) {
  await this.openShift({ floatAmount });
});

When('I fetch the created product', async function () {
  const res = await this.api.request(`/api/inventory/product/${this.store.productId}`);
  this.setLast(res);
});

When('I fetch the product list', async function () {
  const res = await this.api.request('/api/inventory/products');
  this.setLast(res);
});

When('I upload a test image', async function () {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    'base64'
  );
  const fd = new FormData();
  fd.append('image', new Blob([png], { type: 'image/png' }), 'test.png');
  const res = await this.api.request('/api/media/upload', { method: 'POST', body: fd });
  this.setLast(res);
  if (res.data?.id) this.store.mediaId = res.data.id;
});

When('I delete the uploaded image', async function () {
  const res = await this.api.request(`/api/media/library/${this.store.mediaId}`, { method: 'DELETE' });
  this.setLast(res);
});

When('I bulk delete all created products', async function () {
  const res = await this.api.request('/api/inventory/products/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids: this.store.productIds || [] }),
  });
  this.setLast(res);
});

When('I create a paid sale', async function () {
  await this.createSale({ status: 1, paid: 5, total: 5 });
});

When('I create a paid sale in the open shift', async function () {
  await this.createSale({ status: 1, paid: 5, total: 5, shift_id: this.store.shiftId });
});

When('I create a held order', async function () {
  await this.createSale({ status: 0, ref_number: 'H-1', paid: 0, total: 5 });
});

When('I close the open shift with counted cash {float}', async function (countedCash) {
  const res = await this.api.request(`/api/shifts/${this.store.shiftId}/close`, {
    method: 'POST',
    body: JSON.stringify({ countedCash }),
  });
  this.setLast(res);
});

// --- sales / transactions -------------------------------------------------
When('I fetch the created sale', async function () {
  const res = await this.getSale(this.store.saleId);
  this.setLast(res);
});

When('I fetch all transactions', async function () {
  const res = await this.api.request('/api/all');
  this.setLast(res);
});

When('I fetch held orders', async function () {
  const res = await this.api.request('/api/on-hold');
  this.setLast(res);
});

When('I fetch customer orders', async function () {
  const res = await this.api.request('/api/customer-orders');
  this.setLast(res);
});

When('I fetch transactions between {string} and {string}', async function (start, end) {
  const res = await this.api.request(`/api/by-date?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  this.setLast(res);
});

When('I fetch the X report for the shift', async function () {
  const res = await this.api.request(`/api/shifts/${this.store.shiftId}/x-report`);
  this.setLast(res);
});

When('I fetch the Z report for the shift', async function () {
  const res = await this.api.request(`/api/shifts/${this.store.shiftId}/z-report`);
  this.setLast(res);
});

When('I fetch the transactions for the open shift', async function () {
  const res = await this.api.request(`/api/shifts/${this.store.shiftId}/transactions`);
  this.setLast(res);
});

When('I fetch the best sellers', async function () {
  const res = await this.api.request('/api/reports/best-sellers');
  this.setLast(res);
});

When('I fetch the sales summary between {string} and {string}', async function (start, end) {
  const res = await this.api.request(
    `/api/reports/summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
  this.setLast(res);
});

When('I create a paid sale with fulfillment {string}', async function (fulfillment) {
  await this.createSale({ status: 1, paid: 5, total: 5, fulfillment });
});

When(
  'I create a delivery sale with name {string} contact {string} address {string}',
  async function (name, contact, address) {
    await this.createSale({
      status: 1,
      paid: 5,
      total: 5,
      fulfillment: 'delivery',
      delivery_name: name,
      delivery_contact: contact,
      delivery_address: address,
    });
  }
);

When('I create a sale with discount {float}', async function (discount) {
  await this.createSale({ status: 1, paid: 5, total: 5, discount });
});

When('I create a sale with tax {float}', async function (tax) {
  await this.createSale({ status: 1, paid: 5, total: 5, tax });
});

When('I create a split-payment sale with cash {float} and card {float}', async function (cash, card) {
  const total = cash + card;
  await this.createSale({
    status: 1,
    total,
    paid: total,
    payment_breakdown: [
      { method: 'cash', amount: cash },
      { method: 'card', amount: card },
    ],
    change: Math.max(0, cash - total),
  });
});

When('I create a cash sale tendered {float} for total {float}', async function (tender, total) {
  await this.createSale({
    status: 1,
    total,
    paid: tender,
    payment_breakdown: [{ method: 'cash', amount: tender }],
    change: Math.max(0, tender - total),
  });
});

When('I sell {int} of the created product for {float} each', async function (qty, price) {
  const total = qty * price;
  const res = await this.api.request('/api/new', {
    method: 'POST',
    body: JSON.stringify(
      this.saleBody({
        status: 1,
        paid: total,
        total,
        payment_breakdown: [{ method: 'cash', amount: total }],
        items: [{ id: this.store.productId, name: 'Item', price, quantity: qty, cost: 0, categoryId: 0 }],
      })
    ),
  });
  this.setLast(res);
  if (res.data?.id) this.store.saleId = res.data.id;
});

When('I sell {int} of the created product for {float} each dated {string}', async function (qty, price, date) {
  const total = qty * price;
  const res = await this.api.request('/api/new', {
    method: 'POST',
    body: JSON.stringify(
      this.saleBody({
        status: 1,
        paid: total,
        total,
        date,
        payment_breakdown: [{ method: 'cash', amount: total }],
        items: [{ id: this.store.productId, name: 'Item', price, quantity: qty, cost: 0, categoryId: 0 }],
      })
    ),
  });
  this.setLast(res);
  if (res.data?.id) this.store.saleId = res.data.id;
});

When('I sell {int} of the created product for {float} each on till {int}', async function (qty, price, till) {
  const total = qty * price;
  const res = await this.api.request('/api/new', {
    method: 'POST',
    body: JSON.stringify(
      this.saleBody({
        status: 1,
        paid: total,
        total,
        till,
        payment_breakdown: [{ method: 'cash', amount: total }],
        items: [{ id: this.store.productId, name: 'Item', price, quantity: qty, cost: 0, categoryId: 0 }],
      })
    ),
  });
  this.setLast(res);
  if (res.data?.id) this.store.saleId = res.data.id;
});

Then('the top best seller should be the created product', async function () {
  const res = await this.api.request('/api/reports/best-sellers');
  assert.equal(res.data?.[0]?.id, this.store.productId, 'top best seller should match the created product');
});

When('I complete the held order as paid', async function () {
  const res = await this.api.request(`/api/new/${this.store.saleId}`, {
    method: 'PUT',
    body: JSON.stringify(
      this.saleBody({ status: 1, paid: 5, total: 5, ref_number: '' })
    ),
  });
  this.setLast(res);
  if (res.data?.ref_number) this.store.refNumber = res.data.ref_number;
});

When('I create a refunded sale', async function () {
  await this.createSale({ status: 2, paid: 0, total: 5 });
});

When('I create a sale with JSON:', async function (docString) {
  const body = JSON.parse(
    docString.replace(/\{\{(\w+)\}\}/g, (_, k) => this.store[k] ?? '')
  );
  await this.createSale(body);
});

When('I create a sale in the open shift with JSON:', async function (docString) {
  const body = JSON.parse(
    docString.replace(/\{\{(\w+)\}\}/g, (_, k) => this.store[k] ?? '')
  );
  await this.createSale({ ...body, shift_id: this.store.shiftId });
});

When('I delete the created sale', async function () {
  const res = await this.api.request('/api/delete', {
    method: 'POST',
    body: JSON.stringify({ orderId: this.store.saleId }),
  });
  this.setLast(res);
});

When('I fetch recent transactions', async function () {
  const end = new Date(Date.now() + 86400000).toISOString();
  const start = new Date(Date.now() - 86400000).toISOString();
  const res = await this.api.request(
    `/api/by-date?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
  this.setLast(res);
});

// --------------------------------------------------------------------------
// Assertions
// --------------------------------------------------------------------------
Then('the response status should be {int}', function (code) {
  this.assertLastStatus(code);
});

Then('the response should be ok', function () {
  assert.ok(
    this.last?.data?.ok === true || (this.last?.status >= 200 && this.last?.status < 300),
    'expected an ok response'
  );
});

Then('the response body {string} should be {string}', function (path, expected) {
  const actual = this.getPath(this.last?.body, path);
  let exp = expected;
  if (typeof actual === 'number') exp = Number(expected);
  else if (typeof actual === 'boolean') exp = expected === 'true';
  else if (actual === null) exp = null;
  assert.deepEqual(actual, exp, `expected ${path} === ${expected} but got ${JSON.stringify(actual)}`);
});

Then('the response body {string} should contain {string}', function (path, expected) {
  const actual = this.getPath(this.last?.body, path);
  const arr = Array.isArray(actual)
    ? actual
    : Array.isArray(this.last?.body)
      ? this.last.body
      : [];
  assert.ok(
    arr.includes(expected) || arr.some((x) => x?.name === expected) || String(actual).includes(expected),
    `expected ${path} to contain "${expected}"`
  );
});

Then('the response body {string} should not contain {string}', function (path, expected) {
  const actual = this.getPath(this.last?.body, path);
  const arr = Array.isArray(actual)
    ? actual
    : Array.isArray(this.last?.body)
      ? this.last.body
      : [];
  assert.ok(
    !arr.includes(expected) && !arr.some((x) => x?.name === expected) && !String(actual).includes(expected),
    `did not expect ${path} to contain "${expected}"`
  );
});

Then('the response body {string} should deep equal:', function (path, docString) {
  const actual = this.getPath(this.last?.body, path);
  assert.deepEqual(actual, JSON.parse(docString));
});

Then('the response body should contain field {string}', function (path) {
  assert.notEqual(this.getPath(this.last?.body, path), undefined, `expected field ${path} to exist`);
});

Then('the response body {string} should have {int} items', function (path, n) {
  const actual = this.getPath(this.last?.body, path);
  assert.equal(Array.isArray(actual) ? actual.length : undefined, n, `expected ${path} to have ${n} items`);
});

Then('the response body should have {int} items', function (n) {
  const actual = this.last?.body;
  assert.equal(Array.isArray(actual) ? actual.length : undefined, n, `expected body to have ${n} items`);
});

Then('the product list should include {string}', async function (name) {
  const product = await this.findProduct(name);
  assert.ok(product, `expected a product named "${name}" in the catalog`);
});

Then('the product list should not include {string}', async function (name) {
  const product = await this.findProduct(name);
  assert.equal(product, undefined, `did not expect a product named "${name}" in the catalog`);
});

Then('product {string} should have quantity {int}', async function (name, qty) {
  const product = await this.findProduct(name);
  assert.ok(product, `product ${name} not found`);
  assert.equal(product.quantity, qty, `expected quantity ${qty} but got ${product.quantity}`);
});

Then('product {string} should be hot', async function (name) {
  const product = await this.findProduct(name);
  assert.ok(product?.hot, `expected product ${name} to be flagged hot`);
});

Then('the last invoice number should match {string}', function (pattern) {
  assert.match(this.store.refNumber || '', new RegExp(pattern));
});

Then('the last sale change should be {float}', async function (expected) {
  const res = await this.getSale(this.store.saleId);
  const sale = res.data || res;
  assert.equal(sale.change, Number(expected), `expected change ${expected} but got ${sale.change}`);
});

Then('the stock movements for the product should include a {string} of {int}', async function (type, qty) {
  const res = await this.api.request(
    `/api/inventory/stock-movements?productId=${this.store.productId}`
  );
  const found = (res.data?.movements || []).some(
    (m) => m.type === type && m.quantityChange === (type === 'sale' || type === 'wastage' ? -qty : qty)
  );
  assert.ok(found, `expected a ${type} movement of ${qty}`);
});
