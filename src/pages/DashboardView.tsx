import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Wallet,
  Warehouse,
  PieChart as PieChartIcon,
  CheckCircle2,
  Inbox,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Users,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';


import { api, Category, Product, Settings, Transaction, User, DrawerSession } from '../api/client';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { getPosBridge, isElectronBridge } from '../bridge';
import { Sparkline } from '@/components/Sparkline';
import { LiveOrderQueue } from '@/components/LiveOrderQueue';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
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
  buildFulfillmentBreakdown,
  type FulfillmentSlice,
  buildCashierPerformance,
  type CashierPerformance,
  buildTeamOverview,
  type TeamMemberOverview,
  buildDashboardExportData,
  type DashboardExportData,
  exportDashboardToCsv,
  exportDashboardToXlsx,
} from '../lib/dashboard';
import { isLowStock, getStockQuantity, getLowStockThreshold } from '../lib/stock';

type StockSummary = { items: number; outOfStock: number; changesToday: number; stockWorth: number; spentTotal: number } | null;

type DrawerSummary = {
  till: number;
  openSession: DrawerSession | null;
  closedSessions: DrawerSession[];
  summary: {
    totalSessions: number;
    totalFloat: number;
    totalClose: number;
    totalVariance: number;
  };
} | null;

type DashboardState = {
  kpis: Kpis | null;
  trend: TrendPoint[];
  prevTrend: TrendPoint[];
  categorySlices: CategorySlice[];
  topProducts: TopProduct[];
  fulfillmentSlices: FulfillmentSlice[];
  stock: StockSummary;
  drawerSummary: DrawerSummary;
  lowStockProducts: Product[];
  cashierPerformance: CashierPerformance[];
  users: User[];
  teamOverview: TeamMemberOverview[];
  loading: boolean;
  error: string | null;
};

const RANGE_LABELS: Record<string, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  custom: 'Custom range',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function compactCurrency(n: number, symbol: string) {
  if (n >= 1000) return `${symbol}${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${symbol}${Math.round(n)}`;
}

export default function DashboardView({
  settings,
  range,
  onQuickSale,
  onHeldClick,
  onVoidClick,
  onSalesClick,
  onStockClick,
  onReportsClick,
  onDrawerClick,
}: {
  settings: Settings | null;
  range?: DateRange;
  onQuickSale?: () => void;
  onHeldClick?: () => void;
  onVoidClick?: () => void;
  onSalesClick?: (userId?: number) => void;
  onStockClick?: (filter: 'low' | 'out') => void;
  onReportsClick?: () => void;
  onDrawerClick?: () => void;
}) {
  const { hasRole } = useAuth();
  const isManagerOrAdmin = hasRole('Manager', 'Admin');
  const [state, setState] = useState<DashboardState>({
    kpis: null,
    trend: [],
    prevTrend: [],
    categorySlices: [],
    topProducts: [],
    fulfillmentSlices: [],
    stock: null,
    drawerSummary: null,
    lowStockProducts: [],
    cashierPerformance: [],
    users: [],
    teamOverview: [],
    loading: true,
    error: null,
  });
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [viewMode, setViewMode] = useState<'line' | 'heatmap'>('line');
  const symbol = settings?.symbol || 'Rs';
  const fmt = (n: number) => `${symbol}${Number(n).toFixed(2)}`;
  const greeting = useMemo(() => getGreeting(), []);
  const fmtTooltip = (
    value: number | string | readonly (number | string)[] | undefined
  ) => fmt(Number(Array.isArray(value) ? value[0] : value));

  const trendConfig = {
    total: { label: 'Sales', color: 'var(--chart-1)' },
    previous: { label: 'Previous', color: 'var(--chart-4)' },
  } satisfies ChartConfig;
  const topConfig = { revenue: { label: 'Revenue', color: 'var(--chart-2)' } } satisfies ChartConfig;
  const categoryConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    state.categorySlices.forEach((s, i) => {
      cfg[s.category] = { label: s.category, color: `var(--chart-${(i % 5) + 1})` };
    });
    return cfg;
  }, [state.categorySlices]);

  const fulfillmentConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    state.fulfillmentSlices.forEach((s, i) => {
      cfg[s.fulfillment] = { label: s.fulfillment, color: `var(--chart-${(i % 5) + 1})` };
    });
    return cfg;
  }, [state.fulfillmentSlices]);

  const loadData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const activeRange = range ?? buildDateRange('today');
      const prev = previousRange(activeRange);

      const [
        current,
        prevTx,
        held,
        categories,
        voidedTx,
        stock,
        products,
        drawerSummary,
        users,
        drawerSessions,
      ] = await Promise.all([
        api
          .getByDate({ start: activeRange.start, end: activeRange.end, user: 0, till: 0, status: 1 })
          .catch(() => [] as Transaction[]),
        api
          .getByDate({ start: prev.start, end: prev.end, user: 0, till: 0, status: 1 })
          .catch(() => [] as Transaction[]),
        api.getOnHold().catch(() => [] as Transaction[]),
        api.getCategories().catch(() => [] as Category[]),
        // Voided transactions for KPIs
        api
          .getByDate({ start: activeRange.start, end: activeRange.end, user: 0, till: 0, status: 2 })
          .catch(() => [] as Transaction[]),
        // Stock money is Manager/Admin only — cashiers simply don't see these tiles
        api
          .getStockSummary({ start: activeRange.start, end: activeRange.end })
          .catch(() => null),
        api.getProducts().catch(() => [] as Product[]),
        // Drawer summary for Manager/Admin only
        isManagerOrAdmin
          ? api.getDrawerSummary(settings?.till).catch(() => null)
          : Promise.resolve(null),
        // Users for cashier performance (Manager/Admin only)
        isManagerOrAdmin ? api.getUsers().catch(() => [] as User[]) : Promise.resolve([] as User[]),
        // Drawer sessions for team overview (Manager/Admin only)
        isManagerOrAdmin
          ? api.getDrawerSessions({ status: 'open', till: settings?.till }).catch(() => [] as DrawerSession[])
          : Promise.resolve([] as DrawerSession[]),
      ]);
      const kpis = computeKpis({ transactions: current, previous: prevTx, held, voided: voidedTx, products });
      const trend = buildTrendSeries(current, activeRange);
      const prevTrend = buildTrendSeries(prevTx, prev);
      const categorySlices = buildCategoryBreakdown(current, categories);
      const topProducts = buildTopProducts(current, 5);
      const fulfillmentSlices = buildFulfillmentBreakdown(current);
      const lowStockProducts = products.filter(isLowStock);
      const cashierPerformance = isManagerOrAdmin
        ? buildCashierPerformance(current, users)
        : [];
      const teamOverview = isManagerOrAdmin
        ? buildTeamOverview(drawerSessions, held, current, users)
        : [];

      setState({
        kpis,
        trend,
        prevTrend,
        categorySlices,
        topProducts,
        fulfillmentSlices,
        stock,
        drawerSummary,
        lowStockProducts,
        cashierPerformance,
        users,
        teamOverview,
        loading: false,
        error: null,
      });
      setUpdatedAt(Date.now());
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load dashboard',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.start, range?.end, range?.preset, isManagerOrAdmin, settings?.till]);

  useEffect(() => {
    void loadData();
    const id = setInterval(() => void loadData(), 60_000);
    return () => clearInterval(id);
  }, [loadData]);

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!state.kpis) return;
    try {
      const activeRange = range ?? buildDateRange('today');
      const prev = previousRange(activeRange);
      
      const exportData = buildDashboardExportData(
        state.trend.length > 0 ? [] : [], // We need the actual transactions - they're not stored in state
        [],
        [],
        [],
        [],
        [],
        [],
        activeRange
      );
      
      // Instead, we'll use the data already computed in state
      const data: DashboardExportData = {
        kpis: {
          sales: state.kpis.sales,
          orders: state.kpis.orders,
          aov: state.kpis.aov,
          profit: state.kpis.profit,
          marginPct: state.kpis.marginPct,
          heldOrders: state.kpis.heldOrders,
          lowStock: state.kpis.lowStock,
          voidCount: state.kpis.voidCount,
          voidAmount: state.kpis.voidAmount,
          voidRate: state.kpis.voidRate,
        },
        trend: state.trend,
        categoryBreakdown: state.categorySlices,
        topProducts: state.topProducts,
        fulfillmentBreakdown: state.fulfillmentSlices,
        cashierPerformance: state.cashierPerformance,
      };

      const symbol = settings?.symbol || 'Rs';

      if (format === 'xlsx') {
        const workbook = exportDashboardToXlsx(data, symbol);
        const base64 = Buffer.from(workbook).toString('base64');
        const bridge = getPosBridge();
        await bridge.saveFile({
          defaultName: `dashboard-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
          type: 'xlsx',
          data: base64,
        });
      } else {
        const files = exportDashboardToCsv(data, symbol);
        const bridge = getPosBridge();
        const toBase64 = (s: string) => {
          const bytes = new TextEncoder().encode(s);
          let bin = '';
          bytes.forEach((b) => (bin += String.fromCharCode(b)));
          return btoa(bin);
        };
        for (const file of files) {
          await bridge.saveFile({
            defaultName: file.filename,
            type: 'csv',
            data: toBase64(file.content),
          });
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

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

  const activity = state.trend.map((p, i) => ({
    label: p.label,
    total: p.total,
    previous: state.prevTrend[i]?.total ?? 0,
  }));
  const maxTotal = Math.max(1, ...state.trend.map((p) => p.total));

  const cards: CardDef[] = k
    ? [
        {
          title: "Today's Sales",
          value: fmt(k.sales),
          pct: k.salesDeltaPct,
          hint: 'vs previous period',
          icon: <DollarSign className="size-4 text-green-600" />,
          iconBg: 'bg-green-100',
          spark: state.trend.map((p) => p.total),
          sparkColor: 'var(--chart-1)',
          onClick: onSalesClick,
        },
        {
          title: 'Orders',
          value: String(k.orders),
          pct: k.ordersDeltaPct,
          hint: 'completed sales',
          icon: <ShoppingCart className="size-4 text-blue-600" />,
          iconBg: 'bg-blue-100',
          spark: state.trend.map((p) => p.orders),
          sparkColor: 'var(--chart-2)',
          onClick: onSalesClick,
        },
        {
          title: 'Profit & Margin',
          value: fmt(k.profit),
          hint: `Margin ${(k.marginPct ?? 0).toFixed(1)}% of sales`,
          icon: <Wallet className="size-4 text-purple-600" />,
          iconBg: 'bg-purple-100',
          spark: state.trend.map((p) => p.profit),
          sparkColor: 'var(--chart-5)',
          onClick: onReportsClick,
        },
        ...(isManagerOrAdmin && state.drawerSummary
          ? (() => {
              const ds = state.drawerSummary!;
              const open = ds.openSession;
              const variance = open?.variance ?? 0;
              const variancePct = open?.floatAmount ? (variance / open.floatAmount) * 100 : 0;
              const lastReconciled = ds.closedSessions.length > 0
                ? new Date(ds.closedSessions[0].closedAt!).toLocaleString()
                : 'Never';
              return [
                {
                  title: 'Cash Drawer',
                  value: fmt(open?.countedCash ?? open?.floatAmount ?? 0),
                  hint: `Float: ${fmt(open?.floatAmount ?? 0)} · Variance: ${fmt(variance)} (${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%)`,
                  icon: <Wallet className="size-4 text-emerald-600" />,
                  iconBg: variance >= 0 ? 'bg-emerald-100' : 'bg-red-100',
                  badge: {
                    label: variance >= 0 ? 'Balanced' : 'Variance',
                    variant: variance >= 0 ? 'default' : 'destructive',
                  },
                  spark: state.trend.map(() => 0),
                  sparkColor: 'var(--chart-3)',
                  onClick: onDrawerClick,
                },
                {
                  title: 'Last Reconciled',
                  value: lastReconciled,
                  hint: `Total sessions: ${ds.summary.totalSessions} · Total variance: ${fmt(ds.summary.totalVariance)}`,
                  icon: <RotateCcw className="size-4 text-slate-600" />,
                  iconBg: 'bg-slate-100',
                  spark: state.trend.map(() => 0),
                  sparkColor: 'var(--chart-4)',
                },
              ];
            })()
          : []),
        ...(state.stock
          ? [
              {
                title: 'Items in Stock',
                value: String(state.stock.items),
                hint: 'Total tracked items',
                icon: <Package className="size-4 text-teal-600" />,
                iconBg: 'bg-teal-100',
                spark: state.trend.map(() => 0),
                sparkColor: 'var(--chart-1)',
              },
              {
                title: 'Out of Stock',
                value: String(state.stock.outOfStock),
                hint: state.stock.outOfStock > 0 ? 'Needs restocking' : 'All items available',
                icon: <AlertTriangle className="size-4 text-red-600" />,
                iconBg: state.stock.outOfStock > 0 ? 'bg-red-100' : 'bg-green-100',
                spark: state.trend.map(() => 0),
                sparkColor: 'var(--chart-2)',
                onClick: () => onStockClick?.('out'),
              },
{
                title: 'Stock Worth',
                value: fmt(state.stock.stockWorth),
                hint: `What your ${state.stock.items} stock items are worth`,
                icon: <Warehouse className="size-4 text-teal-600" />,
                iconBg: 'bg-teal-100',
                spark: state.trend.map(() => 0),
                sparkColor: 'var(--chart-4)',
              },
              {
                title: 'Money Spent on Stock',
                value: fmt(state.stock.spentTotal),
                hint: 'Bought in this period',
                icon: <Package className="size-4 text-orange-600" />,
                iconBg: 'bg-orange-100',
                spark: state.trend.map(() => 0),
                sparkColor: 'var(--chart-5)',
              },
            ]
          : []),
        {
          title: 'Low Stock Products',
          value: String(state.lowStockProducts.length),
          hint:
            state.lowStockProducts.length > 0
              ? `${state.lowStockProducts.length} product(s) need attention`
              : 'All products well stocked',
          icon: <AlertTriangle className="size-4 text-amber-600" />,
          iconBg: state.lowStockProducts.length > 0 ? 'bg-amber-100' : 'bg-green-100',
          spark: state.trend.map(() => 0),
          sparkColor: 'var(--chart-3)',
          onClick: () => onStockClick?.('low'),
        },
      ]
    : [];

  const categoryTotal = state.categorySlices.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Page header */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground">
            {settings?.store || 'Store POS'} · {rangeLabel} overview
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live · updated {Math.round((Date.now() - updatedAt) / 1000)}s ago
<Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon-sm" className="ml-1" aria-label="Refresh" onClick={loadData}>
                    <RefreshCw className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon-sm" className="ml-1" aria-label="Export dashboard">
                        <Download className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                        <FileSpreadsheet className="size-4 mr-2" /> Export to Excel (.xlsx)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('csv')}>
                        <FileText className="size-4 mr-2" /> Export to CSV (multiple files)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
              <TooltipContent>Export Dashboard</TooltipContent>
            </Tooltip>
        </div>
      </header>


      {/* Performance */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Performance
        </h2>
        {state.loading && !k ? (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: state.stock ? 6 : 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-lg" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <KpiCard key={c.title} {...c} />
            ))}
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Daily Selling Activity</CardTitle>
                <p className="text-xs text-muted-foreground">{rangeLabel} vs previous period</p>
              </div>
              {(range?.preset === 'today' || (range?.preset === 'custom' && 
                (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000 <= 1)) && (
                <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
                  <TabsList className="h-7 bg-transparent">
                    <TabsTrigger value="line" className="h-6 px-2 text-xs gap-1">
                      <BarChart3 className="size-3.5" aria-hidden="true" />
                      Line
                    </TabsTrigger>
                    <TabsTrigger value="heatmap" className="h-6 px-2 text-xs gap-1">
                      <Package className="size-3.5" aria-hidden="true" />
                      Heatmap
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </CardHeader>
            <CardContent>
              {state.loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : state.trend.length === 0 ? (
                <EmptyInline
                  icon={<BarChart3 className="size-6" />}
                  title="No sales in this period"
                  description="Completed sales will appear here as a trend against the previous period."
                />
              ) : viewMode === 'heatmap' && (range?.preset === 'today' || (range?.preset === 'custom' && 
                (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000 <= 1)) ? (
                <div className="h-[280px] w-full">
                  <HourlyHeatmap trend={state.trend} symbol={symbol} />
                </div>
              ) : (
                <ChartContainer config={trendConfig} className="h-[280px] w-full">
                  <AreaChart data={activity} margin={{ left: 4, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="fillActivity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.2} />
                      </linearGradient>
                      <linearGradient id="fillPrevious" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-previous)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--color-previous)" stopOpacity={0} />
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
                      tickFormatter={(v: number) => compactCurrency(v, symbol)}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      width={56}
                      domain={[0, (max: number) => Math.ceil(max * 1.1)]}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={fmtTooltip} />}
                      cursor={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="previous"
                      stroke="var(--color-previous)"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="url(#fillPrevious)"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="var(--color-total)"
                      strokeWidth={2}
                      fill="url(#fillActivity)"
                      isAnimationActive={false}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-3">
            {/* Category donut with side legend */}
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
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <ChartContainer
                      config={categoryConfig}
                      className="mx-auto h-[220px] w-[220px] shrink-0"
                    >
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
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {state.categorySlices.map((s) => (
                            <Cell key={s.category} fill={`var(--color-${s.category})`} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <ul className="flex w-full flex-col gap-1.5">
                      {state.categorySlices.map((s, i) => {
                        const pct = categoryTotal ? (s.revenue / categoryTotal) * 100 : 0;
                        return (
                          <li key={s.category} className="flex items-center gap-2 text-sm">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ background: `var(--chart-${(i % 5) + 1})` }}
                            />
                            <span className="flex-1 truncate">{s.category}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {pct.toFixed(0)}%
                            </span>
                            <span className="w-20 text-right font-medium tabular-nums">
                              {compactCurrency(s.revenue, symbol)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top products with revenue / quantity toggle */}
            <Card>
              <CardHeader>
                <CardTitle>Best Sellers</CardTitle>
                <p className="text-xs text-muted-foreground">Top 5 products · revenue vs quantity</p>
              </CardHeader>
              <CardContent>
                {state.loading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : state.topProducts.length === 0 ? (
                  <EmptyInline
                    icon={<Package className="size-6" />}
                    title="No product sales yet"
                    description="Your best sellers will appear here."
                  />
                ) : (
                  <BestSellersChart
                    products={state.topProducts}
                    symbol={symbol}
                    config={topConfig}
                  />
                )}
              </CardContent>
            </Card>

            {/* Fulfillment breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Fulfillment Type</CardTitle>
                <p className="text-xs text-muted-foreground">Sales split by order type</p>
              </CardHeader>
              <CardContent>
                {state.loading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : state.fulfillmentSlices.length === 0 ? (
                  <EmptyInline
                    icon={<Package className="size-6" />}
                    title="No fulfillment data"
                    description="Sales by fulfillment type will appear here."
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <ChartContainer
                      config={fulfillmentConfig}
                      className="mx-auto h-[220px] w-[220px] shrink-0"
                    >
                      <PieChart>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent nameKey="fulfillment" formatter={fmtTooltip} />
                          }
                        />
                        <Pie
                          data={state.fulfillmentSlices}
                          dataKey="revenue"
                          nameKey="fulfillment"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {state.fulfillmentSlices.map((s) => (
                            <Cell key={s.fulfillment} fill={`var(--color-${s.fulfillment})`} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <ul className="flex w-full flex-col gap-1.5">
                      {state.fulfillmentSlices.map((s, i) => {
                        const fulfillmentTotal = state.fulfillmentSlices.reduce((sum, f) => sum + f.revenue, 0);
                        const pct = fulfillmentTotal ? (s.revenue / fulfillmentTotal) * 100 : 0;
                        return (
                          <li key={s.fulfillment} className="flex items-center gap-2 text-sm">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ background: `var(--chart-${(i % 5) + 1})` }}
                            />
                            <span className="flex-1 truncate capitalize">{s.fulfillment}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {pct.toFixed(0)}%
                            </span>
                            <span className="w-20 text-right font-medium tabular-nums">
                              {compactCurrency(s.revenue, symbol)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team Performance — Manager/Admin only */}
      {isManagerOrAdmin && state.cashierPerformance.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Team Performance
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Cashier KPIs</CardTitle>
              <p className="text-xs text-muted-foreground">
                {rangeLabel} · Click a row to view filtered sales
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-4">
                        CASHIER
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        SALES
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        ORDERS
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        AOV
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        VOIDS
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.cashierPerformance.map((cp) => (
                      <TableRow
                        key={cp.userId}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onSalesClick?.(cp.userId)}
                      >
                        <TableCell className="font-medium pl-4">{cp.userName}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{fmt(cp.sales)}</TableCell>
                        <TableCell className="text-right tabular-nums">{cp.orders}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{fmt(cp.aov)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cp.voids > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {cp.voids}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Live + Inventory */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Operations
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <TeamOverview team={state.teamOverview} symbol={symbol} onResumeHeld={onHeldClick} />
          <LiveOrderQueue symbol={symbol} onResume={() => onQuickSale?.()} />
        </div>
      </section>
    </div>
  );
}

/* ── Team Overview widget ────────────────────────────── */

function TeamOverview({
  team,
  symbol,
  onResumeHeld,
}: {
  team: TeamMemberOverview[];
  symbol: string;
  onResumeHeld?: (userId: number) => void;
}) {
  if (team.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Team Overview
          </CardTitle>
          <p className="text-xs text-muted-foreground">No active cashiers</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No cashiers currently clocked in</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" />
          Team Overview
        </CardTitle>
        <p className="text-xs text-muted-foreground">{team.length} cashier(s) clocked in</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-4">CASHIER</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-4">HELD ORDERS</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-4">HELD TOTAL</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-4">SALES TODAY</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-4">ORDERS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((member) => (
                <TableRow key={member.userId} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium pl-4">{member.userName}</TableCell>
                  <TableCell className="text-right tabular-nums pr-4">
                    {member.heldOrdersCount > 0 ? (
                      <Badge variant="secondary" className="text-xs cursor-pointer hover:var(--accent)" onClick={() => onResumeHeld?.(member.userId)}>
                        {member.heldOrdersCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums pr-4">
                    {member.heldOrdersTotal > 0 ? `${symbol}${member.heldOrdersTotal.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums pr-4">{symbol}{member.salesToday.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums pr-4">{member.ordersToday}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── KPI card with trend + sparkline ─────────────────── */

type CardDef = {
  title: string;
  value: string;
  pct?: number;
  hint?: string;
  icon?: ReactNode;
  iconBg?: string;
  spark?: number[];
  sparkColor?: string;
  badge?: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
  onClick?: () => void;
};

 function KpiCard({ title, value, pct, hint, icon,iconBg, spark, sparkColor, badge, onClick }: CardDef) {
  const hasTrend = typeof pct === 'number';
  const up = (pct ?? 0) >= 0;
  const Wrapper = onClick ? 'button' : 'div';
  const testId = 'kpi-' + String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      className={
        'text-left' +
        (onClick ? ' rounded-xl outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring' : '')
      }
    >
      <Card className={'h-full' + (onClick ? '' : '')}>
        <CardContent className="flex h-full flex-col gap-4 px-4 py-0">
          <div className="flex justify-between items-center gap-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconBg ?? 'bg-muted'} text-muted-foreground`}>
              {icon}
            </span>
            <div className="flex items-center gap-2">
              {hasTrend &&
                (up ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="size-3.5" />
                    {up ? '+' : ''}
                    {(pct as number).toFixed(0)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
                    <TrendingDown className="size-3.5" />
                    {(pct as number).toFixed(0)}%
                  </span>
                ))}
              {badge && (
                <Badge variant={badge.variant} className="text-xs">
                  {badge.label}
                </Badge>
              )}
            </div>
          </div>
          <div>
          <span className="text-sm font-normal text-muted-foreground">{title}</span>
          </div>
          <div className="text-2xl font-bold leading-none tracking-tight">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </CardContent>
      </Card>
    </Wrapper>
  );
}

/* ── Best sellers with revenue / quantity toggle ─────── */

function BestSellersChart({
  products,
  symbol,
  config,
}: {
  products: TopProduct[];
  symbol: string;
  config: ChartConfig;
}) {
  const [metric, setMetric] = useState<'revenue' | 'quantity'>('revenue');
  return (
    <div>
      <Tabs value={metric} onValueChange={(v) => setMetric(v as 'revenue' | 'quantity')} className="w-full">
        <div className="mb-2 flex justify-end">
          <TabsList className="h-7">
            <TabsTrigger value="revenue" className="h-5 px-2 text-xs">Revenue</TabsTrigger>
            <TabsTrigger value="quantity" className="h-5 px-2 text-xs">Quantity</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
      <ChartContainer
        config={config}
        className="w-full"
        style={{ height: Math.max(220, products.length * 56) }}
      >
        <BarChart data={products} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(v: number) => (metric === 'revenue' ? compactCurrency(v, symbol) : String(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={120}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  metric === 'revenue'
                    ? `${symbol}${Number(value).toFixed(2)}`
                    : `${value} sold`
                }
              />
            }
            cursor={false}
          />
          <Bar
            dataKey={metric}
            fill="var(--color-revenue)"
            radius={[0, 4, 0, 4]}
            barSize={20}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

/* ── Hourly Heatmap ──────────────────────────────────────── */

function HourlyHeatmap({
  trend,
  symbol,
}: {
  trend: TrendPoint[];
  symbol: string;
}) {
  const maxTotal = Math.max(1, ...trend.map((p) => p.total));
  const maxOrders = Math.max(1, ...trend.map((p) => p.orders));
  const [metric, setMetric] = useState<'total' | 'orders'>('total');

  const getIntensity = (value: number, max: number) => {
    const ratio = max === 0 ? 0 : value / max;
    if (ratio === 0) return 'bg-muted';
    if (ratio < 0.25) return 'bg-primary/10';
    if (ratio < 0.5) return 'bg-primary/30';
    if (ratio < 0.75) return 'bg-primary/60';
    return 'bg-primary';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Sales intensity by hour (darker = busier)</p>
        <Tabs value={metric} onValueChange={setMetric} className="w-auto">
          <TabsList className="h-7 bg-transparent">
            <TabsTrigger value="total" className="h-6 px-2 text-xs">Revenue</TabsTrigger>
            <TabsTrigger value="orders" className="h-6 px-2 text-xs">Orders</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid grid-cols-12 gap-1" role="img" aria-label="Hourly sales heatmap">
        {trend.map((point, index) => {
          const value = metric === 'total' ? point.total : point.orders;
          const max = metric === 'total' ? maxTotal : maxOrders;
          const intensity = getIntensity(value, max);
          const label = `${point.label}`;
          const displayValue = metric === 'total' 
            ? `${symbol}${Number(value).toFixed(2)}` 
            : `${value} orders`;
          
          return (
            <div
              key={index}
              className={`relative flex flex-col items-center justify-end p-2 rounded-md transition-colors hover:shadow-md ${intensity}`}
              style={{ minHeight: '80px' }}
              title={`${label}: ${displayValue}`}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[10px] font-medium text-primary">
                {displayValue}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-muted" />
          <span>Quiet</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/10" />
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/30" />
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/60" />
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary" />
          <span>Peak</span>
        </span>
      </div>
    </div>
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
