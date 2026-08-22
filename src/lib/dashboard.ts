import type { Category, Product, Transaction } from '../api/client';
import type { DateRange } from './dateRange';
import { isLowStock } from './stock';
import { buildWorkbook, buildCsv, salesRows, catalogRows, customerRows, type ExportRow, type DatasetSheet } from './export';

export type Kpis = {
  sales: number;
  salesDeltaPct: number;
  orders: number;
  ordersDeltaPct: number;
  aov: number;
  aovDeltaPct: number;
  heldOrders: number;
  profit: number;
  marginPct: number;
  lowStock: number;
  voidCount: number;
  voidAmount: number;
  voidRate: number;
};

export type KpiInput = {
  transactions: Transaction[];
  previous: Transaction[];
  held: Transaction[];
  voided: Transaction[];
  products?: Product[];
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

export function computeKpis({ transactions, previous, held, voided, products = [] }: KpiInput): Kpis {
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
  const lowStock = products.filter(isLowStock).length;

  const voidCount = voided.length;
  const voidAmount = voided.reduce((sum, t) => sum + Number(t.total || 0), 0);
  const voidRate = orders > 0 ? (voidCount / orders) * 100 : 0;

  return {
    sales,
    salesDeltaPct: pctChange(sales, prevSales),
    orders,
    ordersDeltaPct: pctChange(orders, prevOrders),
    aov,
    aovDeltaPct: pctChange(aov, prevAov),
    heldOrders,
    profit,
    marginPct,
    lowStock,
    voidCount,
    voidAmount,
    voidRate,
  };
}

export type TrendPoint = { label: string; total: number; orders: number; profit: number; voided: number };

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
    const voidBuckets = new Array(24).fill(0);
    for (const t of transactions) {
      const h = new Date(t.date).getHours();
      totalBuckets[h] += Number(t.total || 0);
      orderBuckets[h] += 1;
      profitBuckets[h] += t.items.reduce((s, it) => s + lineItemProfit(it), 0);
    }
    // We need a separate pass for voided transactions, but we don't have them here.
    // The voided amounts will be passed separately from the dashboard view.
    return totalBuckets.map((total, h) => ({
      label: `${String(h).padStart(2, '0')}:00`,
      total,
      orders: orderBuckets[h],
      profit: profitBuckets[h],
      voided: 0,
    }));
  }

  const sums = new Map<string, { total: number; orders: number; profit: number }>();
  for (const t of transactions) {
    const date = new Date(t.date);
    const key = [date.getFullYear(), date.getMonth(), date.getDate()].join('-');
    const cur = sums.get(key) ?? { total: 0, orders: 0, profit: 0 };
    cur.total += Number(t.total || 0);
    cur.orders += 1;
    cur.profit += t.items.reduce((s, it) => s + lineItemProfit(it), 0);
    sums.set(key, cur);
  }

  const points: TrendPoint[] = [];
  const cur = new Date(range.start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(range.end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    const key = [cur.getFullYear(), cur.getMonth(), cur.getDate()].join('-');
    const v = sums.get(key) ?? { total: 0, orders: 0, profit: 0 };
    points.push({ label: formatDay(cur), total: v.total, orders: v.orders, profit: v.profit, voided: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return points;
}

/** Merge voided transaction amounts into trend points as negative values. */
export function mergeVoidedIntoTrend(
  trend: TrendPoint[],
  voided: Transaction[],
  range: DateRange
): TrendPoint[] {
  const voidSums = new Map<string, number>();
  for (const t of voided) {
    const date = new Date(t.date);
    const key = [date.getFullYear(), date.getMonth(), date.getDate()].join('-');
    voidSums.set(key, (voidSums.get(key) || 0) + Number(t.total || 0));
  }

  const hourly = range.preset === 'today' || (range.preset === 'custom' &&
    (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000 <= 1);
  if (hourly) {
    const hourlySums = new Map<number, number>();
    for (const t of voided) {
      const hour = new Date(t.date).getHours();
      hourlySums.set(hour, (hourlySums.get(hour) || 0) + Number(t.total || 0));
    }
    return trend.map((point, index) => ({ ...point, voided: hourlySums.get(index) || 0 }));
  }
  return trend.map((point) => {
    const match = [...voidSums.entries()].find(([key]) => {
      const [year, month, day] = key.split('-').map(Number);
      const date = new Date(year, month, day);
      return formatDay(date) === point.label;
    });
    return { ...point, voided: match?.[1] || 0 };
  });
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

export type FulfillmentSlice = { fulfillment: string; revenue: number; count: number };

/** Revenue and order count per fulfillment type, sorted by revenue descending. */
export function buildFulfillmentBreakdown(transactions: Transaction[]): FulfillmentSlice[] {
  const totals = new Map<string, { revenue: number; count: number }>();
  for (const t of transactions) {
    const type = t.fulfillment || 'takeaway';
    const cur = totals.get(type) || { revenue: 0, count: 0 };
    cur.revenue += Number(t.total || 0);
    cur.count += 1;
    totals.set(type, cur);
  }
  return [...totals.entries()]
    .map(([fulfillment, { revenue, count }]) => ({ fulfillment, revenue, count }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type CashierPerformance = {
  userId: number;
  userName: string;
  sales: number;
  orders: number;
  aov: number;
  voids: number;
};

/**
 * Build per-cashier performance metrics for the current date range.
 * Only includes cashiers (role !== 'Admin') who have transactions in the period.
 */
export function buildCashierPerformance(
  transactions: Transaction[],
  users: { id: number; fullname: string; role: string }[]
): CashierPerformance[] {
  const userMap = new Map(users.map((u) => [u.id, u.fullname]));
  const cashierTotals = new Map<number, { sales: number; orders: number; voids: number }>();

  for (const t of transactions) {
    const uid = t.user_id || 0;
    if (uid === 0) continue;

    const user = users.find((u) => u.id === uid);
    if (!user || user.role === 'Admin') continue;

    const cur = cashierTotals.get(uid) || { sales: 0, orders: 0, voids: 0 };
    if (t.status === 2) {
      cur.voids += 1;
    } else if (t.status === 1) {
      cur.sales += Number(t.total || 0);
      cur.orders += 1;
    }
    cashierTotals.set(uid, cur);
  }

  return [...cashierTotals.entries()]
    .map(([userId, { sales, orders, voids }]) => ({
      userId,
      userName: userMap.get(userId) || `User ${userId}`,
      sales,
      orders,
      aov: orders > 0 ? sales / orders : 0,
      voids,
    }))
    .sort((a, b) => b.sales - a.sales);
}

export type TeamMemberOverview = {
  userId: number;
  userName: string;
  heldOrdersCount: number;
  heldOrdersTotal: number;
  salesToday: number;
  ordersToday: number;
};

/**
 * Build team overview for the dashboard Operations section.
 * Combines active drawer sessions (clocked-in cashiers) with their held orders and today's sales.
 * Excludes Admin users.
 */
export function buildTeamOverview(
  sessions: { id: number; userId?: number; userName?: string; status: string; openedAt: string }[],
  heldOrders: Transaction[],
  transactions: Transaction[],
  users: { id: number; fullname: string; role: string }[]
): TeamMemberOverview[] {
  const userMap = new Map(users.map((u) => [u.id, { name: u.fullname, role: u.role }]));

  const activeCashiers = sessions
    .filter((s) => s.status === 'open' && s.userId != null)
    .map((s) => {
      const userInfo = userMap.get(s.userId!);
      if (!userInfo || userInfo.role === 'Admin') return null;
      return { userId: s.userId!, userName: s.userName || userInfo.name };
    })
    .filter((c): c is { userId: number; userName: string } => c !== null);

  const heldByUser = new Map<number, { count: number; total: number }>();
  for (const h of heldOrders) {
    const uid = h.user_id || 0;
    if (uid === 0) continue;
    const cur = heldByUser.get(uid) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(h.total || 0);
    heldByUser.set(uid, cur);
  }

  const salesByUser = new Map<number, { sales: number; orders: number }>();
  for (const t of transactions) {
    const uid = t.user_id || 0;
    if (uid === 0) continue;
    if (t.status !== 1) continue;
    const cur = salesByUser.get(uid) || { sales: 0, orders: 0 };
    cur.sales += Number(t.total || 0);
    cur.orders += 1;
    salesByUser.set(uid, cur);
  }

  return activeCashiers.map(({ userId, userName }) => {
    const held = heldByUser.get(userId) || { count: 0, total: 0 };
    const sales = salesByUser.get(userId) || { sales: 0, orders: 0 };
    return {
      userId,
      userName,
      heldOrdersCount: held.count,
      heldOrdersTotal: held.total,
      salesToday: sales.sales,
      ordersToday: sales.orders,
    };
  });
}

export type ShiftSummary = {
  sales: number;
  orders: number;
  aov: number;
  heldOrdersCount: number;
  paymentSplit: { cash: number; card: number; mobile: number };
};

/**
 * Build shift summary for a specific cashier.
 * Shows their personal sales, orders, AOV, held orders count, and payment split.
 */
export function buildShiftSummary(
  transactions: Transaction[],
  heldOrders: Transaction[],
  allHeldOrders: Transaction[],
  cashierId: number
): ShiftSummary {
  let sales = 0;
  let orders = 0;
  const paymentSplit = { cash: 0, card: 0, mobile: 0 };

  for (const t of transactions) {
    if (t.user_id !== cashierId) continue;
    if (t.status !== 1) continue;
    sales += Number(t.total || 0);
    orders += 1;
    const pt = t.payment_type;
    if (pt === 1) paymentSplit.cash += Number(t.total || 0);
    else if (pt === 2) paymentSplit.card += Number(t.total || 0);
    else if (pt === 3) paymentSplit.mobile += Number(t.total || 0);
  }

  let heldOrdersCount = 0;
  for (const h of allHeldOrders) {
    if (h.user_id === cashierId && h.status === 0) {
      heldOrdersCount += 1;
    }
  }

  const aov = orders > 0 ? sales / orders : 0;

  return {
    sales,
    orders,
    aov,
    heldOrdersCount,
    paymentSplit,
  };
}

export type DashboardExportData = {
  kpis: {
    sales: number;
    orders: number;
    aov: number;
    profit: number;
    marginPct: number;
    heldOrders: number;
    lowStock: number;
    voidCount: number;
    voidAmount: number;
    voidRate: number;
  };
  trend: { label: string; total: number; orders: number; profit: number; voided: number }[];
  categoryBreakdown: { category: string; revenue: number }[];
  topProducts: { name: string; revenue: number; quantity: number }[];
  fulfillmentBreakdown: { fulfillment: string; revenue: number; count: number }[];
  cashierPerformance: { userId: number; userName: string; sales: number; orders: number; aov: number; voids: number }[];
};

/**
 * Build comprehensive dashboard export data for the current date range.
 */
export function buildDashboardExportData(
  transactions: Transaction[],
  previous: Transaction[],
  held: Transaction[],
  voided: Transaction[],
  products: Product[],
  categories: Category[],
  users: { id: number; fullname: string; role: string }[],
  range: DateRange
): DashboardExportData {
  const kpis = computeKpis({ transactions, previous, held, voided, products });
  const trend = buildTrendSeries(transactions, range);
  const prevTrend = buildTrendSeries(previous, { ...range, start: previous[0]?.date || range.start, end: previous[previous.length - 1]?.date || range.end });
  const mergedTrend = mergeVoidedIntoTrend(trend, voided, range);
  const categorySlices = buildCategoryBreakdown(transactions, categories);
  const topProducts = buildTopProducts(transactions, 10);
  const fulfillmentSlices = buildFulfillmentBreakdown(transactions);
  const cashierPerformance = buildCashierPerformance(transactions, users);

  return {
    kpis: {
      sales: kpis.sales,
      orders: kpis.orders,
      aov: kpis.aov,
      profit: kpis.profit,
      marginPct: kpis.marginPct,
      heldOrders: kpis.heldOrders,
      lowStock: kpis.lowStock,
      voidCount: kpis.voidCount,
      voidAmount: kpis.voidAmount,
      voidRate: kpis.voidRate,
    },
    trend: mergedTrend,
    categoryBreakdown: categorySlices,
    topProducts,
    fulfillmentBreakdown: fulfillmentSlices,
    cashierPerformance,
  };
}

/**
 * Export dashboard data to CSV format (multiple files per dataset).
 */
export function exportDashboardToCsv(
  data: DashboardExportData,
  symbol: string
): { filename: string; content: string }[] {
  const files: { filename: string; content: string }[] = [];

  // KPIs CSV
  const kpiHeaders = ['Metric', 'Value'];
  const kpiRows = [
    ['Sales', symbol + data.kpis.sales.toFixed(2)],
    ['Orders', String(data.kpis.orders)],
    ['AOV', symbol + data.kpis.aov.toFixed(2)],
    ['Profit', symbol + data.kpis.profit.toFixed(2)],
    ['Margin %', data.kpis.marginPct.toFixed(2) + '%'],
    ['Held Orders', String(data.kpis.heldOrders)],
    ['Low Stock Items', String(data.kpis.lowStock)],
    ['Void Count', String(data.kpis.voidCount)],
    ['Void Amount', symbol + data.kpis.voidAmount.toFixed(2)],
    ['Void Rate %', data.kpis.voidRate.toFixed(2) + '%'],
  ];
  files.push({ filename: 'dashboard-kpis.csv', content: buildCsv(kpiHeaders, kpiRows) });

  // Trend CSV
  const trendHeaders = ['Period', 'Sales', 'Orders', 'Profit', 'Voided'];
  const trendRows = data.trend.map(p => [p.label, symbol + p.total.toFixed(2), String(p.orders), symbol + p.profit.toFixed(2), symbol + p.voided.toFixed(2)]);
  files.push({ filename: 'dashboard-trend.csv', content: buildCsv(trendHeaders, trendRows) });

  // Category CSV
  const catHeaders = ['Category', 'Revenue', 'Percentage'];
  const catTotal = data.categoryBreakdown.reduce((s, c) => s + c.revenue, 0);
  const catRows = data.categoryBreakdown.map(c => [c.category, symbol + c.revenue.toFixed(2), catTotal > 0 ? ((c.revenue / catTotal) * 100).toFixed(1) + '%' : '0%']);
  files.push({ filename: 'dashboard-categories.csv', content: buildCsv(catHeaders, catRows) });

  // Top Products CSV
  const prodHeaders = ['Product', 'Revenue', 'Quantity'];
  const prodRows = data.topProducts.map(p => [p.name, symbol + p.revenue.toFixed(2), String(p.quantity)]);
  files.push({ filename: 'dashboard-top-products.csv', content: buildCsv(prodHeaders, prodRows) });

  // Fulfillment CSV
  const fulfillHeaders = ['Fulfillment Type', 'Revenue', 'Orders'];
  const fulfillRows = data.fulfillmentBreakdown.map(f => [f.fulfillment, symbol + f.revenue.toFixed(2), String(f.count)]);
  files.push({ filename: 'dashboard-fulfillment.csv', content: buildCsv(fulfillHeaders, fulfillRows) });

  // Cashier Performance CSV
  const cashierHeaders = ['Cashier', 'Sales', 'Orders', 'AOV', 'Voids'];
  const cashierRows = data.cashierPerformance.map(c => [c.userName, symbol + c.sales.toFixed(2), String(c.orders), symbol + c.aov.toFixed(2), String(c.voids)]);
  files.push({ filename: 'dashboard-cashiers.csv', content: buildCsv(cashierHeaders, cashierRows) });

  return files;
}

/**
 * Export dashboard data to Excel workbook (one file, multiple sheets).
 */
export function exportDashboardToXlsx(
  data: DashboardExportData,
  symbol: string
): Uint8Array {
  const sheets: DatasetSheet[] = [];

  // KPIs sheet
  const kpiRows: ExportRow[] = [
    { Metric: 'Sales', Value: symbol + data.kpis.sales.toFixed(2) },
    { Metric: 'Orders', Value: String(data.kpis.orders) },
    { Metric: 'AOV', Value: symbol + data.kpis.aov.toFixed(2) },
    { Metric: 'Profit', Value: symbol + data.kpis.profit.toFixed(2) },
    { Metric: 'Margin %', Value: data.kpis.marginPct.toFixed(2) + '%' },
    { Metric: 'Held Orders', Value: String(data.kpis.heldOrders) },
    { Metric: 'Low Stock Items', Value: String(data.kpis.lowStock) },
    { Metric: 'Void Count', Value: String(data.kpis.voidCount) },
    { Metric: 'Void Amount', Value: symbol + data.kpis.voidAmount.toFixed(2) },
    { Metric: 'Void Rate %', Value: data.kpis.voidRate.toFixed(2) + '%' },
  ];
  sheets.push({ name: 'KPIs', rows: kpiRows });

  // Trend sheet
  const trendRows: ExportRow[] = data.trend.map(p => ({
    Period: p.label,
    Sales: symbol + p.total.toFixed(2),
    Orders: String(p.orders),
    Profit: symbol + p.profit.toFixed(2),
    Voided: symbol + p.voided.toFixed(2),
  }));
  sheets.push({ name: 'Trend', rows: trendRows });

  // Category sheet
  const catTotal = data.categoryBreakdown.reduce((s, c) => s + c.revenue, 0);
  const catRows: ExportRow[] = data.categoryBreakdown.map(c => ({
    Category: c.category,
    Revenue: symbol + c.revenue.toFixed(2),
    Percentage: catTotal > 0 ? ((c.revenue / catTotal) * 100).toFixed(1) + '%' : '0%',
  }));
  sheets.push({ name: 'Categories', rows: catRows });

  // Top Products sheet
  const prodRows: ExportRow[] = data.topProducts.map(p => ({
    Product: p.name,
    Revenue: symbol + p.revenue.toFixed(2),
    Quantity: String(p.quantity),
  }));
  sheets.push({ name: 'Top Products', rows: prodRows });

  // Fulfillment sheet
  const fulfillRows: ExportRow[] = data.fulfillmentBreakdown.map(f => ({
    Fulfillment: f.fulfillment,
    Revenue: symbol + f.revenue.toFixed(2),
    Orders: String(f.count),
  }));
  sheets.push({ name: 'Fulfillment', rows: fulfillRows });

  // Cashier Performance sheet
  const cashierRows: ExportRow[] = data.cashierPerformance.map(c => ({
    Cashier: c.userName,
    Sales: symbol + c.sales.toFixed(2),
    Orders: String(c.orders),
    AOV: symbol + c.aov.toFixed(2),
    Voids: String(c.voids),
  }));
  sheets.push({ name: 'Cashiers', rows: cashierRows });

  return buildWorkbook(sheets);
}
