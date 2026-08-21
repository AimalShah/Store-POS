import jwt from 'jsonwebtoken';
import { bootApp } from './helpers.js';
import { loadJwtSecret, mapShift, getDb } from '../server/db.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Shifts: opening a shift records the cashier name', () => {
  test('stores the logged-in user name (no longer NULL)', async () => {
    const login = await app.client.login();
    const { data: shift } = await app.client.request(
      '/api/shifts/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 100, till: 1 }) },
      login.token
    );

    expect(shift.userName).toBeTruthy();
    expect(shift.userName).toBe(login.user.fullname);
  });

  test('falls back to "Unknown" when the token lacks a fullname (old-token bug)', async () => {
    // Get the actual JWT secret from the database
    const jwtSecret = loadJwtSecret();
    
    const legacyToken = jwt.sign(
      { id: 1, username: 'admin', perm_transactions: 1 },
      jwtSecret,
      { expiresIn: '12h' }
    );
    const res = await app.client.request(
      '/api/shifts/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 50, till: 1 }) },
      legacyToken
    );

    expect(res.data.id).toBeTruthy();
    expect(res.data.userName).toBe('Unknown');
  });
});

describe('mapShift: JSON parsing robustness', () => {
  test('parses valid x_report_json and z_report_json', async () => {
    const login = await app.client.login();
    
    // Open shift
    const { data: openShift } = await app.client.request(
      '/api/shifts/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 100, till: 1 }) },
      login.token
    );
    
    // Create a product and make a sale to have data in the shift
    await app.createProduct('Test Product', 10, 'Test', false, 50);
    
    const { data: tx } = await app.client.request('/api/new', {
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
        subtotal: 10,
        tax: 0,
        total: 10,
        paid: 10,
        change: 0,
        payment_type: 1,
        payment_breakdown: [{ method: 'cash', amount: 10 }],
        items: [{ id: 1, name: 'Test Product', price: 10, quantity: 1 }],
        date: new Date().toISOString(),
        shift_id: openShift.id,
      }),
    });
    
    // Close shift - this generates x_report_json and z_report_json
    const { data: closedShift } = await app.client.request(
      `/api/shifts/${openShift.id}/close`,
      { method: 'POST', body: JSON.stringify({ countedCash: 110 }) },
      login.token
    );
    
    expect(closedShift.xReport).toBeTruthy();
    expect(closedShift.zReport).toBeTruthy();
    expect(closedShift.xReport.totalSales).toBe(10);
    expect(closedShift.zReport.expectedCash).toBe(110);
  });

  test('handles corrupted x_report_json gracefully (returns null, logs warning)', async () => {
    const login = await app.client.login();
    
    // Open shift
    const { data: openShift } = await app.client.request(
      '/api/shifts/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 100, till: 1 }) },
      login.token
    );
    
    // Directly corrupt the x_report_json in the database
    const db = getDb();
    db.prepare("UPDATE shifts SET x_report_json = 'not valid json{{{' WHERE id = ?").run(openShift.id);
    
    // Fetch the shift via list endpoint - should not crash, xReport should be null
    const { data: shifts } = await app.client.request(
      `/api/shifts/?till=1`,
      { method: 'GET' },
      login.token
    );
    
    const shift = shifts.find(s => s.id === openShift.id);
    expect(shift.xReport).toBeNull();
    expect(shift.zReport).toBeNull();
  });

  test('handles corrupted z_report_json gracefully (returns null, logs warning)', async () => {
    const login = await app.client.login();
    
    // Open shift
    const { data: openShift } = await app.client.request(
      '/api/shifts/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 100, till: 1 }) },
      login.token
    );
    
    // Directly corrupt the z_report_json in the database
    const db = getDb();
    db.prepare("UPDATE shifts SET z_report_json = 'not valid json{{{' WHERE id = ?").run(openShift.id);
    
    // Fetch the shift via list endpoint - should not crash, zReport should be null
    const { data: shifts } = await app.client.request(
      `/api/shifts/?till=1`,
      { method: 'GET' },
      login.token
    );
    
    const shift = shifts.find(s => s.id === openShift.id);
    expect(shift.zReport).toBeNull();
    expect(shift.xReport).toBeNull();
  });

  test('mapShift function directly handles corrupted JSON', () => {
    // Test the mapShift function directly with corrupted JSON
    const rowWithCorruptedX = {
      id: 1,
      user_id: 1,
      user_name: 'Test User',
      till: 1,
      float_amount: 100,
      counted_cash: 110,
      status: 'closed',
      opened_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      x_report_json: 'not valid json{{{',
      z_report_json: '{"totalSales": 10}',
    };
    
    const result = mapShift(rowWithCorruptedX);
    
    expect(result.xReport).toBeNull();
    expect(result.zReport).toEqual({ totalSales: 10 });
    expect(result.id).toBe(1);
  });

  test('mapShift function directly handles corrupted z_report_json', () => {
    // Test the mapShift function directly with corrupted z_report_json
    const rowWithCorruptedZ = {
      id: 1,
      user_id: 1,
      user_name: 'Test User',
      till: 1,
      float_amount: 100,
      counted_cash: 110,
      status: 'closed',
      opened_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      x_report_json: '{"totalSales": 10}',
      z_report_json: 'not valid json{{{',
    };
    
    const result = mapShift(rowWithCorruptedZ);
    
    expect(result.xReport).toEqual({ totalSales: 10 });
    expect(result.zReport).toBeNull();
    expect(result.id).toBe(1);
  });

  test('mapShift function handles null/empty JSON', () => {
    // Test with null/empty JSON fields
    const rowWithNull = {
      id: 1,
      user_id: 1,
      user_name: 'Test User',
      till: 1,
      float_amount: 100,
      counted_cash: 110,
      status: 'closed',
      opened_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      x_report_json: null,
      z_report_json: '',
    };
    
    const result = mapShift(rowWithNull);
    
    expect(result.xReport).toBeNull();
    expect(result.zReport).toBeNull();
    expect(result.id).toBe(1);
  });
});
