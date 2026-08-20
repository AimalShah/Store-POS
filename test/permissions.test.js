import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Permission checks on mutating routes', () => {
  let adminToken;
  let cashierToken;
  
  beforeEach(async () => {
    // Create admin user (id=1) login
    const adminLogin = await app.client.login('admin', 'admin');
    adminToken = adminLogin.token;
    
    // Create a cashier user with NO permissions
    await app.client.request(
      '/api/users/post',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          username: 'cashier', 
          password: 'cashier',
          fullname: 'Cashier User',
          perm_products: 0,
          perm_categories: 0,
          perm_transactions: 0,
          perm_users: 0,
          perm_settings: 0,
        })
      },
      adminToken
    );
    
    const cashierLogin = await app.client.login('cashier', 'cashier');
    cashierToken = cashierLogin.token;
  });

  describe('Transactions', () => {
    test('POST /api/new requires perm_transactions (403 without)', async () => {
      const { status } = await app.client.request(
        '/api/new',
        { 
          method: 'POST', 
          body: JSON.stringify({ 
            items: [], 
            total: 10, 
            paid: 10, 
            status: 1 
          }) 
        },
        cashierToken
      );
      expect(status).toBe(403);
    });

    test('POST /api/new succeeds with perm_transactions', async () => {
      const { status, data } = await app.client.request(
        '/api/new',
        { 
          method: 'POST', 
          body: JSON.stringify({ 
            items: [], 
            total: 10, 
            paid: 10, 
            status: 1 
          }) 
        },
        adminToken
      );
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });

    test('PUT /api/new/:id requires perm_transactions (403 without)', async () => {
      const { status } = await app.client.request(
        '/api/new/1',
        { 
          method: 'PUT', 
          body: JSON.stringify({ 
            items: [], 
            total: 10, 
            paid: 10, 
            status: 1 
          }) 
        },
        cashierToken
      );
      expect(status).toBe(403);
    });

    test('POST /api/delete requires perm_transactions (403 without)', async () => {
      const { status } = await app.client.request(
        '/api/delete',
        { 
          method: 'POST', 
          body: JSON.stringify({ orderId: 1 }) 
        },
        cashierToken
      );
      expect(status).toBe(403);
    });
  });

  describe('Customers', () => {
    test('POST /api/customers/customer requires perm_settings (403 without)', async () => {
      const { status } = await app.client.request(
        '/api/customers/customer',
        { 
          method: 'POST', 
          body: JSON.stringify({ 
            name: 'Test Customer' 
          }) 
        },
        cashierToken
      );
      expect(status).toBe(403);
    });

    test('POST /api/customers/customer succeeds with perm_settings', async () => {
      // Give cashier perm_settings
      await app.client.request(
        '/api/users/post',
        { 
          method: 'POST', 
          body: JSON.stringify({ 
            id: 2,
            username: 'cashier',
            fullname: 'Cashier User',
            perm_settings: 1,
          })
        },
        adminToken
      );
      
      // Re-login to get updated token
      const cashierLogin = await app.client.login('cashier', 'cashier');
      const updatedToken = cashierLogin.token;
      
      const { status, data } = await app.client.request(
        '/api/customers/customer',
        { 
          method: 'POST', 
          body: JSON.stringify({ 
            name: 'Test Customer' 
          }) 
        },
        updatedToken
      );
      expect(status).toBe(200);
    });

    test('PUT /api/customers/customer requires perm_settings (403 without)', async () => {
      const { status } = await app.client.request(
        '/api/customers/customer',
        { 
          method: 'PUT', 
          body: JSON.stringify({ 
            _id: 1,
            name: 'Updated Customer' 
          }) 
        },
        cashierToken
      );
      expect(status).toBe(403);
    });

    test('DELETE /api/customers/:id requires perm_settings (403 without)', async () => {
      const { status } = await app.client.request(
        '/api/customers/customer/1',
        { method: 'DELETE' },
        cashierToken
      );
      expect(status).toBe(403);
    });
  });

  describe('Unauthenticated requests', () => {
    test('POST /api/new returns 401 without auth', async () => {
      const { status } = await app.client.request(
        '/api/new',
        { 
          method: 'POST', 
          body: JSON.stringify({ 
            items: [], 
            total: 10, 
            paid: 10, 
            status: 1 
          }) 
        },
        null
      );
      expect(status).toBe(401);
    });

    test('POST /api/delete returns 401 without auth', async () => {
      const { status } = await app.client.request(
        '/api/delete',
        { 
          method: 'POST', 
          body: JSON.stringify({ orderId: 1 }) 
        },
        null
      );
      expect(status).toBe(401);
    });

    test('POST /api/customers/customer returns 401 without auth', async () => {
      const { status } = await app.client.request(
        '/api/customers/customer',
        { 
          method: 'POST', 
          body: JSON.stringify({ 
            name: 'Test Customer' 
          }) 
        },
        null
      );
      expect(status).toBe(401);
    });
  });
});