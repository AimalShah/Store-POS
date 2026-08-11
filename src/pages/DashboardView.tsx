import { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

import { api, CartItem, Product, Settings, Transaction } from '../api/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';

/* ── helpers ─────────────────────────────────────────────── */

/** Format YYYY-MM-DD in local time for API queries. */
function dateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

type SaleDay = { day: string; total: number };

/* ── types ───────────────────────────────────────────────── */

interface DashboardState {
  todayTotal: number;
  todayCount: number;
  heldCount: number;
  weeklySales: SaleDay[];
  lowStock: { name: string; quantity: number; id: number; threshold: number }[];
  loading: boolean;
  error: string | null;
}

/* ── component ───────────────────────────────────────────── */

export default function DashboardView({ settings }: { settings: Settings | null }) {
  const [state, setState] = useState<DashboardState>({
    todayTotal: 0,
    todayCount: 0,
    heldCount: 0,
    weeklySales: [],
    lowStock: [],
    loading: true,
    error: null,
  });
  const { hasPerm } = useAuth();
  const symbol = settings?.symbol || '$';

  const loadData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const today = dateLocal(new Date());

      // Fetch today's paid sales
      const todaySales = await api.getByDate({
        start: today,
        end: today,
        user: 0,
        till: 0,
        status: 1,
      }).catch(() => [] as Transaction[]);

      const todayTotal = todaySales.reduce((sum, tx) => sum + Number(tx.total), 0);
      const todayCount = todaySales.length;

      // Fetch held orders
      const heldOrders = await api.getOnHold().catch(() => [] as Transaction[]);

      // Fetch 7-day chart data
      const weekly: SaleDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = dateLocal(d);
        const sales = await api.getByDate({
          start: dayStr,
          end: dayStr,
          user: 0,
          till: 0,
          status: 1,
        }).catch(() => [] as Transaction[]);
        const total = sales.reduce((sum, tx) => sum + Number(tx.total), 0);
        const shortLabel = new Date(dayStr).toLocaleDateString('en', { weekday: 'short' });
        weekly.push({ day: shortLabel, total });
      }

      // Low-stock items (only if stock tracking permission exists)
      let lowStockItems: { name: string; quantity: number; id: number; threshold: number }[] = [];
      if (hasPerm('perm_products')) {
        const products = await api.getProducts().catch(() => [] as Product[]);
        lowStockItems = products
          .filter((p) => p.trackStock && p.quantity >= 0 && p.quantity <= (p.lowStockThreshold || 10))
          .map((p) => ({ name: p.name, quantity: p.quantity, id: p.id, threshold: p.lowStockThreshold || 10 }))
          .sort((a, b) => a.quantity - b.quantity);
      }

      setState({
        todayTotal,
        todayCount,
        heldCount: heldOrders.length,
        weeklySales: weekly,
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
  }, [hasPerm]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ── KPI cards ───────────────────────────────────────── */

  const { todayTotal, todayCount, heldCount } = state;

  const kpiCards = [
    {
      title: "Today's Sales",
      value: `${symbol}${todayTotal.toFixed(2)}`,
      hint: 'Paid sales only',
      accent: todayTotal > 0,
    },
    {
      title: 'Sale Count',
      value: String(todayCount),
      hint: 'Completed today',
      accent: todayCount > 0,
    },
    {
      title: 'Held Orders',
      value: String(heldCount),
      hint: 'Pending customers',
      accent: heldCount > 0,
    },
  ];

  /* ── render ──────────────────────────────────────────── */

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

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    kpi.accent ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {kpi.value}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 7-day chart */}
      <Card>
        <CardHeader>
          <CardTitle>Last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          {state.weeklySales.every((d) => d.total === 0) ? (
            <EmptyInline
              title="No sales this week"
              description="Completed sales will appear here with their daily totals."
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={state.weeklySales} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  tickFormatter={(v: any) => `${symbol}${Number(v)}`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => `${symbol}${Number(value).toFixed(2)}`}
                  contentStyle={{ borderRadius: '8px' }}
                />
                <Bar
                  dataKey="total"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Low-stock alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Low Stock Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {state.loading && <Skeleton className="h-8 w-full" />}
          {!state.loading && state.lowStock.length === 0 && hasPerm('perm_products') && (
            <EmptyInline
              title="All stocked up"
              description="No tracked products are below their individual low-stock thresholds. Great job!"
            />
          )}
          {!state.loading && !hasPerm('perm_products') && (
            <EmptyInline
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
                    <th className="pb-2 pl-2 text-left font-medium text-muted-foreground">
                      Product
                    </th>
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
                      <td className="py-2 text-right text-xs text-muted-foreground">
                        {item.threshold}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── shared empty inline helper ─────────────────────────── */

function EmptyInline({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onAction: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onAction}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
