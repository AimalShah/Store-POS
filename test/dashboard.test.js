import { computeKpis, buildTeamOverview, buildShiftSummary } from '../src/lib/dashboard';
import { buildWorkbook, buildCsv, salesRows, catalogRows, customerRows } from '../src/lib/export';

function tx(over = {}) {
  return {
    _id: 1,
    id: 1,
    ref_number: '',
    customer: '0',
    customer_name: '',
    status: 1,
    user_id: 1,
    user: '',
    till: 1,
    discount: 0,
    subtotal: 0,
    tax: 0,
    total: over.total ?? 0,
    paid: 0,
    change: 0,
    payment_type: 1,
    items: over.items ?? [],
    date: '',
    ...over,
  };
}

function prod(over = {}) {
  return {
    _id: 1,
    id: 1,
    name: '',
    price: 0,
    cost: 0,
    category: '',
    quantity: over.quantity ?? 5,
    stock: 1,
    trackStock: true,
    lowStockThreshold: over.lowStockThreshold ?? 10,
    img: '',
    components: [],
    ...over,
  };
}

function session(over = {}) {
  return {
    id: 1,
    till: 1,
    floatAmount: 100,
    countedCash: null,
    variance: null,
    status: 'open',
    openedAt: new Date().toISOString(),
    closedAt: null,
    userId: 1,
    userName: 'John Doe',
    ...over,
  };
}

function user(over = {}) {
  return {
    _id: 1,
    id: 1,
    username: 'cashier1',
    fullname: 'John Doe',
    role: 'Cashier',
    ...over,
  };
}

describe('computeKpis', () => {
  test('sums sales, orders, AOV, profit and margin from the current period', () => {
    const transactions = [
      tx({ total: 100, items: [{ price: 50, cost: 30, quantity: 2 }] }),
      tx({ total: 50, items: [{ price: 25, cost: 10, quantity: 2 }] }),
    ];
    const k = computeKpis({ transactions, previous: [], held: [], voided: [], products: [] });
    expect(k.sales).toBe(150);
    expect(k.orders).toBe(2);
    expect(k.aov).toBe(75);
    // profit: (50-30)*2 + (25-10)*2 = 40 + 30 = 70
    expect(k.profit).toBe(70);
    expect(k.marginPct).toBeCloseTo((70 / 150) * 100, 5);
  });

  test('compares against the previous period for trend deltas', () => {
    const transactions = [tx({ total: 200 })];
    const previous = [tx({ total: 100 })];
    const k = computeKpis({ transactions, previous, held: [], voided: [], products: [] });
    expect(k.salesDeltaPct).toBeCloseTo(100, 5);
    expect(k.ordersDeltaPct).toBeCloseTo(0, 5);
  });

  test('treats growth from zero previous as a 100% increase, not Infinity', () => {
    const k = computeKpis({ transactions: [tx({ total: 50 })], previous: [], held: [], voided: [], products: [] });
    expect(k.salesDeltaPct).toBe(100);
  });

  test('counts held orders', () => {
    const held = [tx({ status: 0, ref_number: 'H-1' })];
    const k = computeKpis({ transactions: [], previous: [], held, voided: [], products: [] });
    expect(k.heldOrders).toBe(1);
  });

  test('counts voided orders and calculates void rate', () => {
    const transactions = [tx({ total: 100 }), tx({ total: 200 })];
    const voided = [tx({ total: 50 }), tx({ total: 75 })];
    const k = computeKpis({ transactions, previous: [], held: [], voided, products: [] });
    expect(k.voidCount).toBe(2);
    expect(k.voidAmount).toBe(125);
    expect(k.voidRate).toBeCloseTo(100, 5); // 2 voided / 2 orders = 100%
  });
});

describe('buildTeamOverview', () => {
  test('returns empty array when no active sessions', () => {
    const result = buildTeamOverview([], [], [], []);
    expect(result).toEqual([]);
  });

  test('returns cashier with held orders count and sales', () => {
    const sessions = [
      session({ id: 1, userId: 1, userName: 'John Doe' }),
    ];
    const heldOrders = [
      tx({ user_id: 1, status: 0, ref_number: 'H-1', total: 50 }),
      tx({ user_id: 1, status: 0, ref_number: 'H-2', total: 75 }),
    ];
    const transactions = [
      tx({ user_id: 1, status: 1, total: 200 }),
      tx({ user_id: 1, status: 1, total: 150 }),
    ];
    const users = [user({ id: 1, fullname: 'John Doe' })];

    const result = buildTeamOverview(sessions, heldOrders, transactions, users);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: 1,
      userName: 'John Doe',
      heldOrdersCount: 2,
      heldOrdersTotal: 125,
      salesToday: 350,
      ordersToday: 2,
    });
  });

  test('excludes admin users from team overview', () => {
    const sessions = [
      session({ id: 1, userId: 1, userName: 'John Doe' }),
      session({ id: 2, userId: 2, userName: 'Admin User' }),
    ];
    const heldOrders = [
      tx({ user_id: 1, status: 0, ref_number: 'H-1', total: 50 }),
    ];
    const transactions = [
      tx({ user_id: 1, status: 1, total: 200 }),
      tx({ user_id: 2, status: 1, total: 500 }),
    ];
    const users = [
      user({ id: 1, fullname: 'John Doe', role: 'Cashier' }),
      user({ id: 2, fullname: 'Admin User', role: 'Admin' }),
    ];

    const result = buildTeamOverview(sessions, heldOrders, transactions, users);

    expect(result).toHaveLength(1);
    expect(result[0].userName).toBe('John Doe');
  });

  test('includes cashier with zero held orders and zero sales', () => {
    const sessions = [
      session({ id: 1, userId: 1, userName: 'Jane Smith' }),
    ];
    const heldOrders = [];
    const transactions = [];
    const users = [user({ id: 1, fullname: 'Jane Smith' })];

    const result = buildTeamOverview(sessions, heldOrders, transactions, users);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: 1,
      userName: 'Jane Smith',
      heldOrdersCount: 0,
      heldOrdersTotal: 0,
      salesToday: 0,
      ordersToday: 0,
    });
  });

  test('matches held orders and sales by user_id', () => {
    const sessions = [
      session({ id: 1, userId: 1, userName: 'Cashier One' }),
      session({ id: 2, userId: 2, userName: 'Cashier Two' }),
    ];
    const heldOrders = [
      tx({ user_id: 1, status: 0, ref_number: 'H-1', total: 100 }),
      tx({ user_id: 2, status: 0, ref_number: 'H-2', total: 200 }),
      tx({ user_id: 2, status: 0, ref_number: 'H-3', total: 50 }),
    ];
    const transactions = [
      tx({ user_id: 1, status: 1, total: 300 }),
      tx({ user_id: 2, status: 1, total: 400 }),
    ];
    const users = [
      user({ id: 1, fullname: 'Cashier One' }),
      user({ id: 2, fullname: 'Cashier Two' }),
    ];

    const result = buildTeamOverview(sessions, heldOrders, transactions, users);

    expect(result).toHaveLength(2);
    const c1 = result.find(r => r.userId === 1);
    const c2 = result.find(r => r.userId === 2);
    expect(c1).toMatchObject({ heldOrdersCount: 1, heldOrdersTotal: 100, salesToday: 300, ordersToday: 1 });
    expect(c2).toMatchObject({ heldOrdersCount: 2, heldOrdersTotal: 250, salesToday: 400, ordersToday: 1 });
  });
});

describe('buildShiftSummary', () => {
  test('returns zero values when no transactions', () => {
    const result = buildShiftSummary([], [], [], 1);
    expect(result).toEqual({
      sales: 0,
      orders: 0,
      aov: 0,
      heldOrdersCount: 0,
      paymentSplit: { cash: 0, card: 0, mobile: 0 },
    });
  });

  test('calculates sales, orders, AOV for cashier', () => {
    const transactions = [
      tx({ user_id: 1, status: 1, total: 100, payment_type: 1 }),
      tx({ user_id: 1, status: 1, total: 200, payment_type: 2 }),
      tx({ user_id: 2, status: 1, total: 500, payment_type: 1 }), // different cashier
    ];
    const heldOrders = [
      tx({ user_id: 1, status: 0, ref_number: 'H-1', total: 50 }),
      tx({ user_id: 2, status: 0, ref_number: 'H-2', total: 75 }),
    ];
    const allHeldOrders = heldOrders;
    const result = buildShiftSummary(transactions, heldOrders, allHeldOrders, 1);

    expect(result.sales).toBe(300);
    expect(result.orders).toBe(2);
    expect(result.aov).toBe(150);
    expect(result.heldOrdersCount).toBe(1);
  });

  test('calculates payment split by type', () => {
    const transactions = [
      tx({ user_id: 1, status: 1, total: 100, payment_type: 1 }), // cash
      tx({ user_id: 1, status: 1, total: 200, payment_type: 2 }), // card
      tx({ user_id: 1, status: 1, total: 50, payment_type: 3 }),  // mobile
      tx({ user_id: 2, status: 1, total: 500, payment_type: 1 }), // different cashier
    ];
    const heldOrders = [];
    const allHeldOrders = [];
    const result = buildShiftSummary(transactions, heldOrders, allHeldOrders, 1);

    expect(result.paymentSplit).toEqual({
      cash: 100,
      card: 200,
      mobile: 50,
    });
  });

  test('includes held orders from allHeldOrders', () => {
    const transactions = [
      tx({ user_id: 1, status: 1, total: 100 }),
    ];
    const heldOrders = [
      tx({ user_id: 1, status: 0, ref_number: 'H-1', total: 50 }),
    ];
    const allHeldOrders = [
      tx({ user_id: 1, status: 0, ref_number: 'H-1', total: 50 }),
      tx({ user_id: 1, status: 0, ref_number: 'H-2', total: 75 }),
    ];
    const result = buildShiftSummary(transactions, heldOrders, allHeldOrders, 1);

    expect(result.heldOrdersCount).toBe(2);
  });

  test('excludes voided transactions from sales', () => {
    const transactions = [
      tx({ user_id: 1, status: 1, total: 100 }),
      tx({ user_id: 1, status: 2, total: 50 }), // voided
    ];
    const heldOrders = [];
    const allHeldOrders = [];
    const result = buildShiftSummary(transactions, heldOrders, allHeldOrders, 1);

    expect(result.sales).toBe(100);
    expect(result.orders).toBe(1);
  });
});

describe('dashboard export utilities', () => {
  test('buildCsv creates valid CSV with headers and rows', () => {
    const headers = ['id', 'name', 'total'];
    const rows = [
      [1, 'Product A', 100],
      [2, 'Product B', 200],
    ];
    const csv = buildCsv(headers, rows);
    expect(csv).toContain('id');
    expect(csv).toContain('name');
    expect(csv).toContain('total');
    expect(csv).toContain('Product A');
    expect(csv).toContain('Product B');
  });

  test('buildCsv escapes quotes in values', () => {
    const headers = ['name'];
    const rows = [['Product "Special"']];
    const csv = buildCsv(headers, rows);
    expect(csv).toContain('"Product ""Special"""');
  });

  test('buildWorkbook creates workbook with sheets', () => {
    const sheets = [
      { name: 'Sheet1', rows: [{ a: 1, b: 2 }, { a: 3, b: 4 }] },
      { name: 'Sheet2', rows: [{ x: 10, y: 20 }] },
    ];
    const workbook = buildWorkbook(sheets);
    expect(workbook instanceof Uint8Array || workbook instanceof ArrayBuffer || Buffer.isBuffer(workbook)).toBe(true);
    const len = workbook.byteLength || workbook.length;
    expect(len).toBeGreaterThan(0);
  });

  test('buildWorkbook skips empty sheets', () => {
    const sheets = [
      { name: 'Empty', rows: [] },
      { name: 'Data', rows: [{ a: 1 }] },
    ];
    const workbook = buildWorkbook(sheets);
    expect(workbook instanceof Uint8Array || workbook instanceof ArrayBuffer || Buffer.isBuffer(workbook)).toBe(true);
    const len = workbook.byteLength || workbook.length;
    expect(len).toBeGreaterThan(0);
  });

  test('salesRows transforms transactions to export rows', () => {
    const transactions = [
      tx({
        id: 1,
        ref_number: 'TX-1',
        date: '2024-01-15T10:00:00Z',
        customer_name: 'John Doe',
        user: 'Cashier One',
        till: 1,
        status: 1,
        subtotal: 100,
        discount: 10,
        tax: 18,
        total: 108,
        paid: 108,
        change: 0,
        payment_type: 1,
        items: [{ quantity: 2 }, { quantity: 1 }],
      }),
    ];
    const rows = salesRows(transactions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      ref_number: 'TX-1',
      customer: 'John Doe',
      cashier: 'Cashier One',
      till: 1,
      status: 'Paid',
      subtotal: 100,
      discount: 10,
      tax: 18,
      total: 108,
      payment: 'Cash',
      items: 3,
    });
  });

  test('catalogRows transforms products to export rows', () => {
    const products = [
      { id: 1, name: 'Product A', category: 'Food', price: 100 },
      { id: 2, name: 'Product B', category: 'Drinks', price: 50 },
    ];
    const rows = catalogRows(products);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 1, name: 'Product A', category: 'Food', price: 100 });
  });

  test('customerRows transforms customers to export rows', () => {
    const customers = [
      { id: 1, name: 'John', phone: '123', email: 'john@test.com', address: '123 St' },
    ];
    const rows = customerRows(customers);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, name: 'John', phone: '123', email: 'john@test.com', address: '123 St' });
  });
});
