import { bootApp } from './helpers.js';
import bcrypt from 'bcryptjs';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Force password change on first login', () => {
  test('admin user has force_password_change = 1 on first run', async () => {
    const db = await import('../server/db.js');
    const user = db.getDb().prepare('SELECT force_password_change FROM users WHERE id = 1').get();
    expect(user.force_password_change).toBe(1);
  });

  test('login returns force_password_change flag', async () => {
    const { status, data } = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin' }) }
    );
    expect(status).toBe(200);
    expect(data.force_password_change).toBe(true);
  });

  test('PIN login returns force_password_change flag', async () => {
    // First set a PIN for admin
    const adminLogin = await app.client.login('admin', 'admin');
    await app.client.request(
      '/api/users/post',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          id: 1,
          username: 'admin',
          fullname: 'Administrator',
          pin: '1234',
        })
      },
      adminLogin.token
    );

    const { status, data } = await app.client.request(
      '/api/users/login-pin',
      { method: 'POST', body: JSON.stringify({ pin: '1234' }) }
    );
    expect(status).toBe(200);
    expect(data.force_password_change).toBe(true);
  });

  test('change password endpoint works', async () => {
    const login = await app.client.login('admin', 'admin');
    expect(login.force_password_change).toBe(true);

    const { status, data } = await app.client.request(
      '/api/users/change-password',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          current_password: 'admin',
          new_password: 'newpassword123',
          confirm_password: 'newpassword123'
        })
      },
      login.token
    );
    expect(status).toBe(200);
    expect(data.ok).toBe(true);

    // Verify force_password_change is now false
    const db = await import('../server/db.js');
    const user = db.getDb().prepare('SELECT force_password_change FROM users WHERE id = 1').get();
    expect(user.force_password_change).toBe(0);
  });

  test('change password rejects wrong current password', async () => {
    const login = await app.client.login('admin', 'admin');
    
    const { status, data } = await app.client.request(
      '/api/users/change-password',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          current_password: 'wrong',
          new_password: 'newpassword123',
          confirm_password: 'newpassword123'
        })
      },
      login.token
    );
    expect(status).toBe(401);
    expect(data.error).toBe('Current password is incorrect');
  });

  test('change password rejects mismatched confirmation', async () => {
    const login = await app.client.login('admin', 'admin');
    
    const { status, data } = await app.client.request(
      '/api/users/change-password',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          current_password: 'admin',
          new_password: 'newpassword123',
          confirm_password: 'different'
        })
      },
      login.token
    );
    expect(status).toBe(400);
    expect(data.error).toBe('New password and confirmation do not match');
  });

  test('change password rejects short password', async () => {
    const login = await app.client.login('admin', 'admin');
    
    const { status, data } = await app.client.request(
      '/api/users/change-password',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          current_password: 'admin',
          new_password: '123',
          confirm_password: '123'
        })
      },
      login.token
    );
    expect(status).toBe(400);
    expect(data.error).toBe('New password must be at least 4 characters');
  });

  test('after password change, login works with new password and force_password_change is false', async () => {
    const login = await app.client.login('admin', 'admin');
    
    await app.client.request(
      '/api/users/change-password',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          current_password: 'admin',
          new_password: 'newpassword123',
          confirm_password: 'newpassword123'
        })
      },
      login.token
    );

    const { status, data } = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'newpassword123' }) }
    );
    expect(status).toBe(200);
    expect(data.force_password_change).toBe(false);
  });
});