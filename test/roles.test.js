import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Roles', () => {
  let adminToken;

  beforeEach(async () => {
    const login = await app.client.login();
    adminToken = login.token;
    await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({
        username: 'manager',
        password: 'manager',
        fullname: 'Manny Manager',
        role: 'Manager',
      }),
    }, adminToken);
    await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({
        username: 'cashier',
        password: 'cashier',
        fullname: 'Cara Cashier',
        role: 'Cashier',
      }),
    }, adminToken);
  });

  async function tokenFor(username, password) {
    const { data } = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    );
    return data.token;
  }

  async function createUserWithRole(role, username) {
    await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({ username, password: username, fullname: username, role }),
    }, adminToken);
    return tokenFor(username, username);
  }

  test('every user account carries exactly one role; the default admin holds Admin', async () => {
    const { status, data } = await app.client.request('/api/users/all');
    expect(status).toBe(200);
    expect(data.find((u) => u.id === 1).role).toBe('Admin');

    await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({ username: 'kate2', password: 'kate2', fullname: 'Kate', role: 'Cashier' }),
    }, adminToken);
    const after = await app.client.request('/api/users/all');
    expect(after.data.find((u) => u.username === 'kate2').role).toBe('Cashier');
  });

  test('cashier can work the till and quick-add a customer, but is blocked from menu APIs', async () => {
    const cashierToken = await tokenFor('cashier', 'cashier');

    const sale = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({ items: [], total: 10, paid: 10, status: 1 }),
    }, cashierToken);
    expect(sale.status).toBe(200);

    const quickAdd = await app.client.request('/api/customers/customer', {
      method: 'POST',
      body: JSON.stringify({ name: 'Quick Add', phone: '123' }),
    }, cashierToken);
    expect(quickAdd.status).toBe(200);

    const menuWrite = await app.client.request('/api/categories/category', {
      method: 'POST',
      body: JSON.stringify({ name: 'Nope' }),
    }, cashierToken);
    expect(menuWrite.status).toBe(403);

    const productCreate = await client_postProduct(cashierToken);
    expect(productCreate.status).toBe(403);
  });

  function client_postProduct(token) {
    const fd = new FormData();
    fd.append('id', '');
    fd.append('name', 'Blocked Burger');
    fd.append('price', '5');
    fd.append('category', '');
    fd.append('quantity', '0');
    fd.append('stock', '0');
    fd.append('img', '');
    return app.client.request('/api/inventory/product', { method: 'POST', body: fd }, token);
  }

  test('manager runs menu, reports and drawer reconciliation, but is blocked from team and settings APIs', async () => {
    const managerToken = await tokenFor('manager', 'manager');

    const category = await app.client.request('/api/categories/category', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sides' }),
    }, managerToken);
    expect(category.status).toBe(200);

    const reports = await app.client.request('/api/reports/summary', {}, managerToken);
    expect(reports.status).toBe(200);

    const drawer = await app.client.request('/api/drawer/summary?till=1', {}, managerToken);
    expect(drawer.status).toBe(200);

    const team = await app.client.request('/api/users/all', {}, managerToken);
    expect(team.status).toBe(403);

    const teamWrite = await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({ username: 'sneak', password: 'x', fullname: 'Sneak', role: 'Admin' }),
    }, managerToken);
    expect(teamWrite.status).toBe(403);

    const auditLog = await app.client.request('/api/audit-log', {}, managerToken);
    expect(auditLog.status).toBe(403);

    const backup = await app.client.request('/api/settings', {}, managerToken);
    expect([403, 404]).toContain(backup.status);
  });

  test('a role change takes effect on the very next request without re-login', async () => {
    const managerToken = await tokenFor('manager', 'manager');
    const before = await app.client.request('/api/users/all', {}, managerToken);
    expect(before.status).toBe(403);

    // Promote manager to Admin using the admin's own token.
    const promote = await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({ id: 2, username: 'manager', fullname: 'Manny Manager', role: 'Admin' }),
    }, adminToken);
    expect(promote.status).toBe(200);

    const after = await app.client.request('/api/users/all', {}, managerToken);
    expect(after.status).toBe(200);
  });

  test('deleting a member removes their access', async () => {
    const cashierToken = await tokenFor('cashier', 'cashier');
    expect((await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({ items: [], total: 1, paid: 1, status: 1 }),
    }, cashierToken)).status).toBe(200);

    const del = await app.client.request('/api/users/user/3', { method: 'DELETE' }, adminToken);
    expect(del.status).toBe(200);

    const afterDelete = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({ items: [], total: 1, paid: 1, status: 1 }),
    }, cashierToken);
    expect([401, 403]).toContain(afterDelete.status);
  });
});

