import { computeKpis } from '../src/lib/dashboard';

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

describe('computeKpis', () => {
  test('sums sales, orders, AOV, profit and margin from the current period', () => {
    const transactions = [
      tx({ total: 100, items: [{ price: 50, cost: 30, quantity: 2 }] }),
      tx({ total: 50, items: [{ price: 25, cost: 10, quantity: 2 }] }),
    ];
    const k = computeKpis({ transactions, previous: [], held: [], products: [] });
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
    const k = computeKpis({ transactions, previous, held: [], products: [] });
    expect(k.salesDeltaPct).toBeCloseTo(100, 5);
    expect(k.ordersDeltaPct).toBeCloseTo(0, 5);
  });

  test('treats growth from zero previous as a 100% increase, not Infinity', () => {
    const k = computeKpis({ transactions: [tx({ total: 50 })], previous: [], held: [], products: [] });
    expect(k.salesDeltaPct).toBe(100);
  });

  test('counts held orders and low-stock products', () => {
    const held = [tx({ status: 0, ref_number: 'H-1' })];
    const products = [
      prod({ quantity: 3, lowStockThreshold: 10 }), // low stock
      prod({ quantity: 50, lowStockThreshold: 10 }), // ok
      prod({ quantity: 2, lowStockThreshold: 10, trackStock: false }), // not tracked
    ];
    const k = computeKpis({ transactions: [], previous: [], held, products });
    expect(k.heldOrders).toBe(1);
    expect(k.lowStock).toBe(1);
  });
});
