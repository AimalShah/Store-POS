import assert from 'node:assert/strict';
import { bootApp } from '../../test/helpers.js';

// Shared state available to every step via `this`.
export class PosWorld {
  constructor() {
    this.app = null;
    this.api = null;
    this.last = null; // { status, body }
    this.store = {}; // cross-step references (created ids, tokens, etc.)
  }

  async boot() {
    this.app = await bootApp();
    this.api = this.app.client;
    return this.api;
  }

  async shutdown() {
    if (this.app) {
      await this.app.close();
      this.app.cleanup();
    }
    this.app = null;
    this.api = null;
    this.last = null;
    this.store = {};
  }

  // --- low level request helpers -----------------------------------------
  setLast(res) {
    this.last = { status: res?.status ?? 200, body: res?.data };
    return res;
  }

  async send(method, path, body) {
    let payload = body;
    if (typeof body === 'string') {
      try {
        payload = JSON.parse(body);
      } catch {
        payload = body;
      }
    }
    const res = await this.api.request(
      path,
      {
        method,
        body: payload == null ? undefined : JSON.stringify(payload),
      }
    );
    return this.setLast(res);
  }

  async sendForm(method, path, fields) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
    const res = await this.api.request(path, { method, body: fd });
    return this.setLast(res);
  }

  // --- auth ---------------------------------------------------------------
  async login(username = 'admin', password = 'admin') {
    const res = await this.api.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setLast(res);
    if (res.data?.token) this.api.token = res.data.token;
    return res;
  }

  async loginPin(pin) {
    const res = await this.api.request('/api/users/login-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    this.setLast(res);
    if (res.data?.token) this.api.token = res.data.token;
    return res;
  }

  asToken(token) {
    this.api.token = token;
  }

  // --- entity factories ---------------------------------------------------
  async createProduct(opts = {}) {
    const fd = new FormData();
    fd.append('id', '');
    fd.append('name', opts.name ?? 'Test Product');
    fd.append('price', String(opts.price ?? 10));
    fd.append('category', opts.category ?? 'Drinks');
    fd.append('quantity', String(opts.quantity ?? 10));
    fd.append('stock', opts.stock === false ? '0' : '1');
    fd.append('cost', String(opts.cost ?? 0));
    fd.append('hot', opts.hot ? '1' : '0');
    fd.append('img', '');
    if (opts.sizes) fd.append('sizes', JSON.stringify(opts.sizes));
    if (opts.modifiers) fd.append('modifiers', JSON.stringify(opts.modifiers));
    if (opts.components) fd.append('components', JSON.stringify(opts.components));
    const res = await this.api.request('/api/inventory/product', { method: 'POST', body: fd });
    this.setLast(res);
    if (res.data?.id) this.store.productId = res.data.id;
    return res;
  }

  async createCategory(name) {
    const res = await this.api.request('/api/categories/category', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    this.setLast(res);
    return res;
  }

  async createCustomer(opts = {}) {
    const res = await this.api.request('/api/customers/customer', {
      method: 'POST',
      body: JSON.stringify({
        name: opts.name ?? 'Walk-in Customer',
        phone: opts.phone ?? '',
        email: opts.email ?? '',
        address: opts.address ?? '',
      }),
    });
    this.setLast(res);
    return res;
  }

  async createCashier(opts = {}) {
    const res = await this.api.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({
        username: opts.username ?? 'cashier1',
        password: opts.password ?? 'cashier1',
        pin: opts.pin ?? '1111',
        fullname: opts.fullname ?? 'Cashier One',
        perm_products: opts.perm_products ? 1 : 0,
        perm_categories: opts.perm_categories ? 1 : 0,
        perm_transactions: opts.perm_transactions ? 1 : 0,
        perm_users: opts.perm_users ? 1 : 0,
        perm_settings: opts.perm_settings ? 1 : 0,
      }),
    });
    this.setLast(res);
    if (res.data?.id) this.store.cashierId = res.data.id;
    return res;
  }

  async openShift(opts = {}) {
    const res = await this.api.request('/api/shifts/open', {
      method: 'POST',
      body: JSON.stringify({
        floatAmount: opts.floatAmount ?? 100,
        till: opts.till ?? 1,
      }),
    });
    this.setLast(res);
    if (res.data?.id) this.store.shiftId = res.data.id;
    return res;
  }

  saleBody(overrides = {}) {
    const item = {
      id: this.store.productId ?? 1,
      name: 'Item',
      price: 5,
      quantity: 1,
      cost: 0,
      categoryId: 0,
      ...(overrides.item || {}),
    };
    return {
      ref_number: '',
      customer: '0',
      customer_name: 'Walk-in Customer',
      status: 1,
      user_id: 1,
      user: 'Administrator',
      till: 1,
      discount: 0,
      subtotal: 5,
      tax: 0,
      total: 5,
      paid: 5,
      change: 0,
      payment_type: 1,
      payment_breakdown: [{ method: 'cash', amount: 5 }],
      items: [item],
      date: new Date().toISOString(),
      ...overrides,
    };
  }

  async createSale(overrides = {}) {
    const res = await this.api.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(this.saleBody(overrides)),
    });
    this.setLast(res);
    if (res.data?.id) this.store.saleId = res.data.id;
    if (res.data?.ref_number) this.store.refNumber = res.data.ref_number;
    return res;
  }

  // --- queries ------------------------------------------------------------
  async getProducts() {
    const res = await this.api.request('/api/inventory/products');
    return res.data || [];
  }

  async findProduct(name) {
    const products = await this.getProducts();
    return products.find((p) => p.name === name);
  }

  async getProduct(id) {
    const res = await this.api.request(`/api/inventory/product/${id}`);
    return res.data;
  }

  async getCategories() {
    const res = await this.api.request('/api/categories/all');
    return res.data || [];
  }

  async getSale(id) {
    return this.api.request(`/api/transaction/${id}`);
  }

  // --- assertions ---------------------------------------------------------
  getPath(obj, path) {
    return path.split('.').reduce((acc, key) => {
      if (acc == null) return undefined;
      const m = key.match(/^(\w+)\[(\d+)\]$/);
      if (m) return acc[m[1]]?.[Number(m[2])];
      return acc[key];
    }, obj);
  }

  assertLastStatus(code) {
    assert.equal(this.last?.status, code, `expected status ${code} but got ${this.last?.status}`);
  }

  assertPath(path, expected) {
    const actual = this.getPath(this.last?.body, path);
    assert.deepEqual(actual, expected, `expected ${path} === ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}
