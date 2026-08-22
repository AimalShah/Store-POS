import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from '../server/index.js';

// bootApp({ dbPath }) reuses an existing database file (for legacy-upgrade
// simulations); bootApp() creates a throwaway one.
export async function bootApp({ dbPath: existingDbPath } = {}) {
  const tmp = path.join(os.tmpdir(), `pos-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const dbPath = existingDbPath || path.join(tmp, 'pos-test.sqlite');
  const baseDir = existingDbPath ? path.dirname(existingDbPath) : tmp;
  const uploadsPath = path.join(baseDir, 'uploads');
  fs.mkdirSync(uploadsPath, { recursive: true });

  const app = await createServer({
    dbPath,
    uploadsPath,
    jwtSecret: 'test-secret',
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const client = {
    base,
    token: null,
    async request(pathname, options = {}, token) {
      const headers = { ...(options.headers || {}) };
      if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      const auth = token === undefined ? client.token : token;
      if (auth) headers.Authorization = `Bearer ${auth}`;
      const res = await fetch(`${base}${pathname}`, { ...options, headers });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return { status: res.status, data };
    },
    async login(username = 'admin', password = 'admin') {
      const { data } = await client.request(
        '/api/users/login',
        { method: 'POST', body: JSON.stringify({ username, password }) }
      );
      client.token = data.token;
      return data;
    },
  };

  return {
    client,
    dbPath,
    async createProduct(name = 'Cola', price = 2.5, category = 'Drinks', stock = true, quantity = 10) {
      await client.login();
      const fd = new FormData();
      fd.append('id', '');
      fd.append('name', name);
      fd.append('price', String(price));
      fd.append('category', category);
      fd.append('quantity', String(quantity));
      fd.append('stock', stock ? '1' : '0');
      fd.append('img', '');
      const { data } = await client.request('/api/inventory/product', { method: 'POST', body: fd });
      return data;
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
    cleanup() {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}
