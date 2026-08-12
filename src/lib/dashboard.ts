import type { Category, Product, Transaction } from '../api/client';
import type { DateRange } from './dateRange';

export type Kpis = {
  sales: number;
  salesDeltaPct: number;
  orders: number;
  ordersDeltaPct: number;
  aov: number;
  aovDeltaPct: number;
  heldOrders: number;
  lowStock: number;
  profit: number;
  marginPct: number;
};

export type KpiInput = {
  transactions: Transaction[];
  previous: Transaction[];
  held: Transaction[];
  products: Product[];
};

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function lineItemProfit(item: Transaction['items'][number]): number {
  const price = Number(item.price) || 0;
  const cost = Number(item.cost) || 0;
  const qty = Number(item.quantity) || 0;
  return (price - cost) * qty;
}

export function computeKpis({ transactions, previous, held, products }: KpiInput): Kpis {
  const sales = transactions.reduce((sum, t) => sum + Number(t.total || 0), 0);
  const prevSales = previous.reduce((sum, t) => sum + Number(t.total || 0), 0);

  const orders = transactions.length;
  const prevOrders = previous.length;

  const aov = orders ? sales / orders : 0;
  const prevAov = prevOrders ? prevSales / prevOrders : 0;

  const profit = transactions.reduce(
    (sum, t) => sum + t.items.reduce((is, it) => is + lineItemProfit(it), 0),
    0
  );
  const marginPct = sales ? (profit / sales) * 100 : 0;

  const heldOrders = held.length;
  const lowStock = products.filter(
    (p) => p.trackStock && p.quantity <= p.lowStockThreshold
  ).length;

  return {
    sales,
    salesDeltaPct: pctChange(sales, prevSales),
    orders,
    ordersDeltaPct: pctChange(orders, prevOrders),
    aov,
    aovDeltaPct: pctChange(aov, prevAov),
    heldOrders,
    lowStock,
    profit,
    marginPct,
  };
}

export type TrendPoint = { label: string; total: number; orders: number; profit: number };

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Sales totals across the range, zero-filled so the timeline is continuous.
 * "Today" is bucketed hourly; longer ranges are daily.
 */
export function buildTrendSeries(transactions: Transaction[], range: DateRange): TrendPoint[] {
  const spanDays =
    (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000;
  const hourly = range.preset === 'today' || (range.preset === 'custom' && spanDays <= 1);
  if (hourly) {
    const totalBuckets = new Array(24).fill(0);
    const orderBuckets = new Array(24).fill(0);
    const profitBuckets = new Array(24).fill(0);
    for (const t of transactions) {
      const h = new Date(t.date).getUTCHours();
      totalBuckets[h] += Number(t.total || 0);
      orderBuckets[h] += 1;
      profitBuckets[h] += t.items.reduce((s, it) => s + lineItemProfit(it), 0);
    }
    return totalBuckets.map((total, h) => ({
      label: `${String(h).padStart(2, '0')}:00`,
      total,
      orders: orderBuckets[h],
      profit: profitBuckets[h],
    }));
  }

  const sums = new Map<string, { total: number; orders: number; profit: number }>();
  for (const t of transactions) {
    const key = new Date(t.date).toISOString().slice(0, 10);
    const cur = sums.get(key) ?? { total: 0, orders: 0, profit: 0 };
    cur.total += Number(t.total || 0);
    cur.orders += 1;
    cur.profit += t.items.reduce((s, it) => s + lineItemProfit(it), 0);
    sums.set(key, cur);
  }

  const points: TrendPoint[] = [];
  const cur = new Date(range.start);
  cur.setUTCHours(0, 0, 0, 0);
  const last = new Date(range.end);
  last.setUTCHours(0, 0, 0, 0);
  while (cur <= last) {
    const key = cur.toISOString().slice(0, 10);
    const v = sums.get(key) ?? { total: 0, orders: 0, profit: 0 };
    points.push({ label: formatDay(cur), total: v.total, orders: v.orders, profit: v.profit });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return points;
}

export type CategorySlice = { category: string; revenue: number };

/** Revenue per product category, sorted by revenue descending. */
export function buildCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[]
): CategorySlice[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    for (const it of t.items) {
      const name = nameById.get(it.categoryId ?? 0) || 'Uncategorized';
      const revenue = (Number(it.price) || 0) * (Number(it.quantity) || 0);
      totals.set(name, (totals.get(name) || 0) + revenue);
    }
  }
  return [...totals.entries()]
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type TopProduct = { name: string; revenue: number; quantity: number };

/** Best-selling products by revenue, optionally limited. */
export function buildTopProducts(transactions: Transaction[], limit = 5): TopProduct[] {
  const totals = new Map<number, TopProduct>();
  for (const t of transactions) {
    for (const it of t.items) {
      const id = it.id;
      const cur =
        totals.get(id) || { name: it.name, revenue: 0, quantity: 0 };
      cur.revenue += (Number(it.price) || 0) * (Number(it.quantity) || 0);
      cur.quantity += Number(it.quantity) || 0;
      totals.set(id, cur);
    }
  }
  return [...totals.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}
