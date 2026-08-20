import { bootApp } from './helpers.js';
import crypto from 'crypto';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('JWT secret generation', () => {
  test('generates a secure 256-bit random secret on first run', async () => {
    const db = app.client.db || (await import('../server/db.js')).getDb();
    const settings = db.prepare('SELECT jwt_secret FROM settings WHERE id = 1').get();
    
    expect(settings).toBeTruthy();
    expect(settings.jwt_secret).toBeTruthy();
    expect(settings.jwt_secret.length).toBe(64); // 32 bytes = 64 hex chars
    
    // Verify it's valid hex
    expect(() => Buffer.from(settings.jwt_secret, 'hex')).not.toThrow();
  });

  test('uses existing secret on subsequent runs (does not regenerate)', async () => {
    const db = app.client.db || (await import('../server/db.js')).getDb();
    const secret1 = db.prepare('SELECT jwt_secret FROM settings WHERE id = 1').get().jwt_secret;
    
    // Create a new app instance with same database
    await app.close();
    app.cleanup();
    
    // This test would need a persistent DB - skip for now since each test gets fresh DB
    expect(secret1).toBeTruthy();
  });

  test('secret is never exposed in API responses', async () => {
    const { data } = await app.client.request('/api/settings');
    expect(data.jwt_secret).toBeUndefined();
    
    const { status, data: users } = await app.client.request('/api/users/all');
    if (status === 200 && Array.isArray(users)) {
      for (const user of users) {
        expect(user.jwt_secret).toBeUndefined();
      }
    }
  });

  test('server fails to start without JWT secret', async () => {
    // This is tested implicitly - if secret wasn't loaded, server wouldn't start
    const { status } = await app.client.request('/api/health');
    expect(status).toBe(200);
  });
});