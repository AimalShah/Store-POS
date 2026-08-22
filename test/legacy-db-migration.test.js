import Database from 'better-sqlite3';
import { bootApp } from './helpers.js';

describe('Legacy database upgrade', () => {
  test('a product_sizes table from the old schema (no cost column) keeps working', async () => {
    // Boot once to create a current-shape database, then regress it to the
    // legacy shape: product_sizes without a cost column.
    const first = await bootApp();
    const { client } = first;
    await client.login();
    const fd = new FormData();
    fd.append('id', '');
    fd.append('name', 'Legacy Pizza');
    fd.append('price', '9');
    fd.append('category', 'Pizzas');
    fd.append('sizes', JSON.stringify([{ name: 'Large', price: 11 }]));
    await client.request('/api/inventory/product', { method: 'POST', body: fd });
    const dbPath = first.dbPath;
    await first.close();

    const raw = new Database(dbPath);
    raw.exec('ALTER TABLE product_sizes DROP COLUMN cost');
    raw.close();

    // Re-open with the upgraded code — the migration must heal the table
    // instead of every /products request dying with "no such column: cost".
    let app;
    try {
      app = await bootApp({ dbPath });
      await app.client.login();
      const { status, data: products } = await app.client.request('/api/inventory/products');
      expect(status).toBe(200);
      const pizza = products.find((p) => p.name === 'Legacy Pizza');
      expect(pizza.sizes).toHaveLength(1);
      expect(pizza.sizes[0].cost).toBe(0);
    } finally {
      if (app) {
        await app.close();
      }
    }
    first.cleanup();
  });
});
