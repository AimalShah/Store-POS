import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createServer } from '../server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(os.tmpdir(), `pos-smoke-${Date.now()}`);
const dbPath = path.join(tmp, 'pos-v3.sqlite');
const uploadsPath = path.join(tmp, 'uploads');

fs.mkdirSync(uploadsPath, { recursive: true });

const app = await createServer({
  dbPath,
  uploadsPath,
  jwtSecret: 'smoke-test-secret',
});

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

async function req(pathname, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${pathname}`, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

try {
  const health = await req('/');
  if (health.status !== 'ok') throw new Error('health failed');

  const login = await req('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  });
  if (!login.token) throw new Error('no token');
  const token = login.token;

  await req(
    '/api/categories/category',
    { method: 'POST', body: JSON.stringify({ name: 'Drinks' }) },
    token
  );

  const fd = new FormData();
  fd.append('id', '');
  fd.append('name', 'Cola');
  fd.append('price', '2.5');
  fd.append('category', 'Drinks');
  fd.append('quantity', '10');
  fd.append('stock', '1');
  fd.append('img', '');
  await req('/api/inventory/product', { method: 'POST', body: fd }, token);

  const products = await req('/api/inventory/products', {}, token);
  const product = products.find((p) => p.name === 'Cola');
  if (!product) throw new Error('product missing');

  const saleRes = await req(
    '/api/new',
    {
      method: 'POST',
      body: JSON.stringify({
        ref_number: '',
        customer: '0',
        customer_name: 'Walk-in Customer',
        status: 1,
        user_id: 1,
        user: 'Administrator',
        till: 1,
        discount: 0,
        subtotal: 5,
        tax: 0,
        total: 5,
        paid: 5,
        change: 0,
        payment_type: 1,
        items: [{ id: product.id, name: 'Cola', price: 2.5, quantity: 2 }],
        date: new Date().toISOString(),
      }),
    },
    token
  );
  if (!/^INV-\d{8}-\d{3}$/.test(saleRes.ref_number)) {
    throw new Error(`expected generated invoice ref, got ${saleRes.ref_number}`);
  }

  const after = await req(`/api/inventory/product/${product.id}`, {}, token);
  if (after.quantity !== 8) {
    throw new Error(`expected qty 8 after sale, got ${after.quantity}`);
  }

  // Terminal-style: bind host 0.0.0.0 simulation via second request with auth
  const tx = await req(
    `/api/by-date?start=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&end=${encodeURIComponent(new Date().toISOString())}&user=0&till=0&status=1`,
    {},
    token
  );
  if (!tx.length) throw new Error('no transactions found');

  const holdRes = await req(
    '/api/new',
    {
      method: 'POST',
      body: JSON.stringify({
        ref_number: 'H-TEST1',
        customer: '0',
        customer_name: 'Walk-in Customer',
        status: 0,
        user_id: 1,
        user: 'Administrator',
        till: 1,
        discount: 0,
        subtotal: 2.5,
        tax: 0,
        total: 2.5,
        paid: 0,
        change: 0,
        payment_type: 1,
        items: [{ id: product.id, name: 'Cola', price: 2.5, quantity: 1 }],
        date: new Date().toISOString(),
      }),
    },
    token
  );
  if (holdRes.ref_number !== 'H-TEST1') {
    throw new Error(`hold ref not preserved, got ${holdRes.ref_number}`);
  }

  const resumed = await req(
    `/api/new/${holdRes.id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        ref_number: '',
        customer: '0',
        customer_name: 'Walk-in Customer',
        status: 1,
        user_id: 1,
        user: 'Administrator',
        till: 1,
        discount: 0,
        subtotal: 2.5,
        tax: 0,
        total: 2.5,
        paid: 2.5,
        change: 0,
        payment_type: 1,
        items: [{ id: product.id, name: 'Cola', price: 2.5, quantity: 1 }],
        date: new Date().toISOString(),
      }),
    },
    token
  );
  if (!/^INV-\d{8}-\d{3}$/.test(resumed.ref_number)) {
    throw new Error(`expected invoice ref on hold resume, got ${resumed.ref_number}`);
  }

  // Reports: summary, by category, by payment method, best sellers
  const startIso = new Date(Date.now() - 86400000).toISOString();
  const endIso = new Date(Date.now() + 86400000).toISOString();
  const report = await req(
    `/api/reports/summary?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
    {},
    token
  );

  if (report.summary.saleCount !== 2) {
    throw new Error(`expected 2 sales in report, got ${report.summary.saleCount}`);
  }
  if (Math.abs(report.summary.totalSales - 7.5) > 0.001) {
    throw new Error(`expected total sales 7.5, got ${report.summary.totalSales}`);
  }
  if (report.summary.itemsSold !== 3) {
    throw new Error(`expected 3 items sold, got ${report.summary.itemsSold}`);
  }

  const drink = report.byCategory.find((c) => c.category === 'Drinks');
  if (!drink || drink.count !== 3 || Math.abs(drink.revenue - 7.5) > 0.001) {
    throw new Error(`unexpected category totals: ${JSON.stringify(report.byCategory)}`);
  }

  const cash = report.byPaymentMethod.find((p) => p.method === 'cash');
  if (!cash || cash.count !== 2 || Math.abs(cash.amount - 7.5) > 0.001) {
    throw new Error(`unexpected payment totals: ${JSON.stringify(report.byPaymentMethod)}`);
  }

  const top = report.bestSellers[0];
  if (!top || top.name !== 'Cola' || top.quantity !== 3 || Math.abs(top.revenue - 7.5) > 0.001) {
    throw new Error(`unexpected best sellers: ${JSON.stringify(report.bestSellers)}`);
  }

  // Export path: all transactions feed the Sales dataset
  const all = await req('/api/all', {}, token);
  if (all.length !== 2) {
    throw new Error(`expected 2 transactions for export, got ${all.length}`);
  }
  if (!all.every((t) => Array.isArray(t.items))) {
    throw new Error('expected every transaction to carry an items array for export');
  }
  const exportedQty = all
    .filter((t) => t.status === 1)
    .reduce((n, t) => n + t.items.reduce((m, i) => m + i.quantity, 0), 0);
  if (exportedQty !== 3) {
    throw new Error(`expected 3 items in export, got ${exportedQty}`);
  }

  // Printer settings: defaults, then save a network config
  const printerDefault = await req('/api/printer/settings', {}, token);
  if (printerDefault.printer.width !== 58 || printerDefault.printer.interface !== '') {
    throw new Error(`unexpected default printer settings: ${JSON.stringify(printerDefault)}`);
  }
  const printerSaved = await req(
    '/api/printer/settings',
    {
      method: 'POST',
      body: JSON.stringify({
        interface: 'network',
        networkHost: '192.168.1.50',
        networkPort: 9100,
        width: 80,
        kotInterface: 'usb',
        kotUsbDevice: '/dev/usb/lp1',
        autoPrintKot: true,
      }),
    },
    token
  );
  if (
    printerSaved.printer.interface !== 'network' ||
    printerSaved.printer.networkHost !== '192.168.1.50' ||
    printerSaved.printer.width !== 80 ||
    printerSaved.printer.kotInterface !== 'usb' ||
    printerSaved.printer.kotUsbDevice !== '/dev/usb/lp1' ||
    printerSaved.printer.autoPrintKot !== true
  ) {
    throw new Error(`printer settings not saved: ${JSON.stringify(printerSaved)}`);
  }

  console.log('SMOKE OK');
  console.log(JSON.stringify({
    health: health.message,
    user: login.user.username,
    productId: product.id,
    stockAfterSale: after.quantity,
    transactions: tx.length,
    invoiceRef: saleRes.ref_number,
    holdResumeRef: resumed.ref_number,
  }, null, 2));
} catch (err) {
  console.error('SMOKE FAILED', err);
  process.exitCode = 1;
} finally {
  server.close();
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
