import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt, Package, Wallet, PieChart as PieChartIcon, CheckCircle2, Inbox, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

import { api, Category, Product, Settings, Transaction } from '../api/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { buildDateRange, previousRange, type DateRange } from '../lib/dateRange';
import {
  computeKpis,
  type Kpis,
  buildTrendSeries,
  type TrendPoint,
  buildCategoryBreakdown,
  type CategorySlice,
  buildTopProducts,
  type TopProduct,
} from '../lib/dashboard';

type LowStockItem = { name: string; quantity: number; id: number; threshold: number };

type DashboardState = {
  kpis: Kpis | null;
  trend: TrendPoint[];
  categorySlices: CategorySlice[];
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
  loading: boolean;
  error: string | null;
};

const RANGE_LABELS: Record<string, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardView({
  settings,
  range,
}: {
  settings: Settings | null;
  range?: DateRange;
}) {
  const [state, setState] = useState<DashboardState>({
    kpis: null,
    trend: [],
    categorySlices: [],
    topProducts: [],
    lowStock: [],
    loading: true,
    error: null,
  });
  const { hasPerm } = useAuth();
  const symbol = settings?.symbol || 'Rs';
  const fmt = (n: number) => `${symbol}${Number(n).toFixed(2)}`;
  const greeting = useMemo(() => getGreeting(), []);
  const fmtTooltip = (
    value: number | string | readonly (number | string)[] | undefined,
  ) => fmt(Number(Array.isArray(value) ? value[0] : value));

  const trendConfig = { total: { label: 'Sales', color: 'var(--chart-1)' } } satisfies ChartConfig;
  const topConfig = { revenue: { label: 'Revenue', color: 'var(--chart-2)' } } satisfies ChartConfig;
  const categoryConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    state.categorySlices.forEach((s, i) => {
      cfg[s.category] = { label: s.category, color: `var(--chart-${(i % 5) + 1})` };
    });
    return cfg;
  }, [state.categorySlices]);

  const loadData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const activeRange = range ?? buildDateRange('today');
      const prev = previousRange(activeRange);

      const [current, prevTx, held, products, categories] = await Promise.all([
        api
          .getByDate({ start: activeRange.start, end: activeRange.end, user: 0, till: 0, status: 1 })
          .catch(() => [] as Transaction[]),
        api
          .getByDate({ start: prev.start, end: prev.end, user: 0, till: 0, status: 1 })
          .catch(() => [] as Transaction[]),
        api.getOnHold().catch(() => [] as Transaction[]),
        hasPerm('perm_products')
          ? api.getProducts().catch(() => [] as Product[])
          : (Promise.resolve([]) as Promise<Product[]>),
        api.getCategories().catch(() => [] as Category[]),
      ]);

      const kpis = computeKpis({ transactions: current, previous: prevTx, held, products });
      const trend = buildTrendSeries(current, activeRange);
      const categorySlices = buildCategoryBreakdown(current, categories);
      const topProducts = buildTopProducts(current, 5);

      const lowStockItems: LowStockItem[] = products
        .filter((p) => p.trackStock && p.quantity >= 0 && p.quantity <= (p.lowStockThreshold || 10))
        .map((p) => ({ name: p.name, quantity: p.quantity, id: p.id, threshold: p.lowStockThreshold || 10 }))
        .sort((a, b) => a.quantity - b.quantity);

      setState({
        kpis,
        trend,
        categorySlices,
        topProducts,
        lowStock: lowStockItems,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load dashboard',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPerm, range?.start, range?.end, range?.preset]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (state.error) {
    return (
      <Card className="mx-auto mt-12 max-w-md">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{state.error}</p>
          <Button onClick={loadData}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const k = state.kpis;
  const rangeLabel = RANGE_LABELS[range?.preset ?? 'today'];

  const deltaCards = k
    ? [
        { title: "Today's Sales", value: fmt(k.sales), pct: k.salesDeltaPct, hint: 'vs previous period', icon: DollarSign },
        { title: 'Orders', value: String(k.orders), pct: k.ordersDeltaPct, hint: 'completed sales', icon: ShoppingCart },
        { title: 'Avg Order Value', value: fmt(k.aov), pct: k.aovDeltaPct, hint: 'per order', icon: Receipt },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Page header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-sm text-muted-foreground">
          {settings?.store || 'Store POS'} · {rangeLabel} overview
        </p>
      </header>

      {/* Performance */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Performance
        </h2>
        {state.loading && !k ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {deltaCards.map((c) => (
              <KpiCard key={c.title} title={c.title} value={c.value} pct={c.pct} hint={c.hint} icon={<c.icon className="size-4 text-muted-foreground" />} />
            ))}
            <KpiCard
              title="Low Stock"
              value={String(k?.lowStock ?? 0)}
              hint="items below threshold"
              warn={(k?.lowStock ?? 0) > 0}
              icon={<Package className="size-4 text-muted-foreground" />}
            />
            <KpiCard
              title="Profit & Margin"
              value={fmt(k?.profit ?? 0)}
              hint={`Margin ${(k?.marginPct ?? 0).toFixed(1)}% of sales`}
              icon={<Wallet className="size-4 text-muted-foreground" />}
            />
          </div>
        )}
      </section>

      {/* Insights */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Insights
        </h2>
        <div className="grid gap-3">
          {/* Sales Trend — full-width, the primary chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Selling Activity</CardTitle>
              <p className="text-xs text-muted-foreground">{rangeLabel}</p>
            </CardHeader>
            <CardContent>
              {state.loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : state.trend.length === 0 ? (
                <EmptyInline
                  icon={<BarChart3 className="size-6" />}
                  title="No sales in this period"
                  description="Completed sales will appear here as a daily trend."
                />
              ) : (
                <ChartContainer config={trendConfig} className="h-[280px] w-full">
                  <AreaChart data={state.trend} margin={{ left: 8, right: 8 }}>
                    <defs>
                      <linearGradient id="fillActivity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `${symbol}${Number(v)}`}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={fmtTooltip} />}
                      cursor={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="var(--color-total)"
                      strokeWidth={2}
                      fill="url(#fillActivity)"
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Category donut */}
            <Card>
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {state.loading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : state.categorySlices.length === 0 ? (
                  <EmptyInline
                    icon={<PieChartIcon className="size-6" />}
                    title="No category data"
                    description="Sales by product category will appear here."
                  />
                ) : (
                  <ChartContainer config={categoryConfig} className="mx-auto h-[260px] w-[260px]">
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent nameKey="category" formatter={fmtTooltip} />
                        }
                      />
                      <Pie
                        data={state.categorySlices}
                        dataKey="revenue"
                        nameKey="category"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {state.categorySlices.map((s) => (
                          <Cell key={s.category} fill={`var(--color-${s.category})`} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="category" />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Top products */}
            <Card>
              <CardHeader>
                <CardTitle>Best Sellers</CardTitle>
                <p className="text-xs text-muted-foreground">By revenue</p>
              </CardHeader>
              <CardContent>
                {state.loading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : state.topProducts.length === 0 ? (
                  <EmptyInline
                    icon={<Package className="size-6" />}
                    title="No product sales yet"
                    description="Your best sellers by revenue will appear here."
                  />
                ) : (
                  <ChartContainer
                    config={topConfig}
                    className="w-full"
                    style={{ height: Math.max(220, state.topProducts.length * 56) }}
                  >
                    <BarChart data={state.topProducts} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        width={120}
                      />
                      <ChartTooltip content={<ChartTooltipContent formatter={fmtTooltip} />} cursor={false} />
                      <Bar
                        dataKey="revenue"
                        fill="var(--color-revenue)"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Inventory */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Inventory
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            {state.loading && <Skeleton className="h-8 w-full" />}
            {!state.loading && state.lowStock.length === 0 && hasPerm('perm_products') && (
              <EmptyInline
                icon={<CheckCircle2 className="size-6" />}
                title="All stocked up"
                description="No tracked products are below their individual low-stock thresholds. Great job!"
              />
            )}
            {!state.loading && !hasPerm('perm_products') && (
              <EmptyInline
                icon={<Inbox className="size-6" />}
                title="Permission needed"
                description="Product permissions must be granted to see low-stock alerts."
                action={{ label: 'Open Team settings', onAction: () => {} }}
              />
            )}
            {!state.loading && state.lowStock.length > 0 && (
              <ScrollArea className="h-56">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 pl-2 text-left font-medium text-muted-foreground">Product</th>
                      <th className="pb-2 text-center font-medium text-muted-foreground">Qty Left</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.lowStock.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="py-2 pl-2">{item.name}</td>
                        <td className="py-2 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.quantity === 0
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            }`}
                          >
                            {item.quantity}
                          </span>
                        </td>
                        <td className="py-2 text-right text-xs text-muted-foreground">{item.threshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/* ── KPI card with trend ─────────────────────────────────── */

function KpiCard({
  title,
  value,
  pct,
  hint,
  warn,
  icon,
}: {
  title: string;
  value: string;
  pct?: number;
  hint?: string;
  warn?: boolean;
  icon?: ReactNode;
}) {
  const hasTrend = typeof pct === 'number';
  const up = (pct ?? 0) >= 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-3 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="mt-1.5 flex items-center gap-1 text-[11px]">
          {hasTrend &&
            (up ? (
              <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="size-3.5 text-red-600 dark:text-red-400" />
            ))}
          {hasTrend && (
            <span
              className={
                up
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {up ? '+' : ''}
              {(pct as number).toFixed(0)}%
            </span>
          )}
          {!hasTrend && warn && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
              needs attention
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── shared empty inline helper ─────────────────────────── */

function EmptyInline({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onAction: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onAction}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
