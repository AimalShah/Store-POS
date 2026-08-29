import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { bootApp } from './helpers.js';

let app;
let client;
let dbPath;
let db;

beforeAll(async () => {
  app = await bootApp();
  client = app.client;
  dbPath = app.dbPath;
  await client.login();
  db = new Database(dbPath);
});

afterAll(() => {
  db?.close();
  app?.close();
  app?.cleanup();
});

function seedRow(label) {
  const txn = db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(`Cat ${label}`);
    const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(`Cat ${label}`);
    db.prepare(
      'INSERT INTO products (name, price, category, category_id) VALUES (?, 2, ?, ?)'
    ).run(`Product ${label}`, `Cat ${label}`, cat.id);
    db.prepare('INSERT INTO customers (name) VALUES (?)').run(`Customer ${label}`);
    db.prepare(
      "INSERT INTO transactions (ref_number, customer_name, total, date) VALUES (?, ?, 10, datetime('now'))"
    ).run(`INV-${label}`, `Customer ${label}`);
    db.prepare(
      "INSERT INTO shifts (user_id, user_name, till, status, opened_at) VALUES (1, 'admin', 1, 'open', datetime('now'))"
    ).run();
    db.prepare(
      "INSERT INTO media_library (filename, created_at) VALUES (?, datetime('now'))"
    ).run(`photo-${label}.jpg`);
    db.prepare("INSERT INTO ingredients (name, unit) VALUES (?, 'pc')").run(`Ingredient ${label}`);
    db.prepare(
      "INSERT INTO audit_log (user_id, user_name, action, entity_type, created_at) VALUES (1, 'admin', 'create', 'product', datetime('now'))"
    ).run();
  });
  txn();
}

function count(table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

describe('Settings: Start as new reset', () => {
  test('refuses to wipe without explicit confirmation', async () => {
    const res = await client.request('/api/settings/reset', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('is admin-only', async () => {
    seedRow('A');
    seedRow('B');
    seedRow('C');

    const users = await client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashpass', role: 'Cashier', fullname: 'Cara' }),
    });
    expect(users.status).toBe(200);

    client.token = null;
    await client.login('cashier', 'cashpass');
    const res = await client.request('/api/settings/reset', {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
    expect(res.status).toBe(403);
    expect(count('products')).toBe(3);

    await client.login('admin', 'admin');
  });

  test('backs everything up as CSV, then wipes business data but keeps config', async () => {
    expect(count('transactions')).toBe(3);
    expect(count('products')).toBe(3);

    const res = await client.request('/api/settings/reset', {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'products', rows: 3 }),
        expect.objectContaining({ table: 'transactions', rows: 3 }),
        expect.objectContaining({ table: 'audit_log', rows: 4 }),
      ])
    );

    const backupDir = res.data.backupDir;
    expect(fs.existsSync(backupDir)).toBe(true);
    for (const { table } of res.data.tables) {
      expect(fs.existsSync(path.join(backupDir, `${table}.csv`))).toBe(true);
    }

    const productsCsv = fs.readFileSync(path.join(backupDir, 'products.csv'), 'utf8');
    expect(productsCsv.startsWith('\ufeff')).toBe(true);
    expect(productsCsv).toContain('Product A');
    expect(productsCsv).toContain('Product C');

    const customersCsv = fs.readFileSync(path.join(backupDir, 'customers.csv'), 'utf8');
    expect(customersCsv).toContain('Customer A');
    expect(customersCsv).toContain('Walk-in Customer');

    for (const table of ['transactions', 'shifts', 'drawer_sessions', 'stock_movements', 'product_components', 'product_sizes', 'stock_entries', 'products', 'categories', 'ingredients', 'media_library']) {
      expect(count(table), `${table} should be wiped`).toBe(0);
    }
    expect(count('audit_log')).toBe(1);

    expect(count('customers')).toBe(1);
    expect(db.prepare('SELECT name FROM customers').get().name).toBe('Walk-in Customer');
    expect(db.prepare('SELECT store FROM settings WHERE id = 1').get()).toBeTruthy();
    expect(db.prepare('SELECT username FROM users WHERE id = 1').get().username).toBe('admin');
    expect(count('users')).toBe(2);

    expect(
      db.prepare("SELECT * FROM sqlite_sequence WHERE name = 'products'").get()
    ).toBeUndefined();

    const auditAfterReset = await client.request('/api/audit-log');
    expect(auditAfterReset.status).toBe(200);
    expect(auditAfterReset.data.total).toBe(1);
    expect(auditAfterReset.data.logs[0].action).toBe('delete');
  });

  test('a product created after the reset starts from id 1 again', async () => {
    const prod = await app.createProduct('Fresh', 1.5, 'Snacks');
    expect(prod.id).toBe(1);
  });
});