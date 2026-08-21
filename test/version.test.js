import { bootApp } from './helpers.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const pkg = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf-8')
);

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('GET /api/version', () => {
  test('returns the current app version from package.json', async () => {
    const { status, data } = await app.client.request('/api/version');
    expect(status).toBe(200);
    expect(data.version).toBe(pkg.version);
    expect(data.name).toBe(pkg.name);
  });

  test('is publicly accessible without authentication', async () => {
    const { status } = await app.client.request('/api/version', {}, null);
    expect(status).toBe(200);
  });
});
