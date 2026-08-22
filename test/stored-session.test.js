import { describe } from 'vitest';
import { getStoredUser, storeSession, clearSession } from '../src/api/client';

// Minimal localStorage stand-in for the node test environment
const storage = new Map();
beforeAll(() => {
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => void storage.set(k, v),
    removeItem: (k) => void storage.delete(k),
  };
});
afterEach(() => storage.clear());

describe('Stored session compatibility', () => {
  test('a user saved before the roles upgrade (no role field) is treated as signed out', () => {
    // Shape written by the pre-#59 build
    localStorage.setItem('pos_user', JSON.stringify({
      _id: 1, id: 1, username: 'admin', fullname: 'Administrator',
      perm_products: 1, perm_categories: 1, perm_transactions: 1, perm_users: 1, perm_settings: 1,
    }));
    expect(getStoredUser()).toBeNull();
  });

  test('a current-shape session survives', () => {
    storeSession('tok', {
      _id: 2, id: 2, username: 'cara', fullname: 'Cara Cashier',
      role: 'Cashier',
    });
    expect(getStoredUser()?.role).toBe('Cashier');
    clearSession();
    expect(getStoredUser()).toBeNull();
  });
});
