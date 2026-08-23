import { useCallback, useEffect, useState } from 'react';
import { PlusCircle, DollarSign, ShoppingCart, CreditCard, Smartphone, Inbox, LogOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api, Transaction, Settings, DrawerSession } from '../api/client';
import { buildDateRange, type DateRange } from '../lib/dateRange';
import { buildShiftSummary, type ShiftSummary } from '../lib/dashboard';
import { useAuth } from '../context/AuthContext';

function compactCurrency(n: number, symbol: string) {
  if (n >= 1000) return `${symbol}${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${symbol}${Math.round(n)}`;
}

export default function ShiftSummaryView({
  settings,
  range,
  onNewSale,
  onHeldOrders,
  onEndShift,
}: {
  settings: Settings | null;
  range?: DateRange;
  onNewSale?: () => void;
  onHeldOrders?: () => void;
  onEndShift?: () => void;
}) {
  const { user, hasRole } = useAuth();
  const isCashier = hasRole('Cashier');
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [drawerSession, setDrawerSession] = useState<DrawerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const symbol = settings?.symbol || 'Rs';
  const fmt = (n: number) => `${symbol}${Number(n).toFixed(2)}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeRange = range ?? buildDateRange('today');
      const cashierId = user?.id || user?._id || 0;

      const [transactions, heldOrders, allHeldOrders, session] = await Promise.all([
        api.getByDate({ start: activeRange.start, end: activeRange.end, user: cashierId, till: 0, status: 1 }).catch(() => [] as Transaction[]),
        api.getOnHold().catch(() => [] as Transaction[]),
        api.getOnHold().catch(() => [] as Transaction[]),
        api.getDrawerSessions({ status: 'open', till: settings?.till }).catch(() => [] as DrawerSession[]),
      ]);

      const cashierHeldOrders = heldOrders.filter(h => h.user_id === cashierId);
      const shiftSummary = buildShiftSummary(transactions, cashierHeldOrders, allHeldOrders, cashierId);
      const openSession = session.find(s => s.status === 'open' && s.userId === cashierId) || null;

      setSummary(shiftSummary);
      setDrawerSession(openSession);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shift summary');
      setLoading(false);
    }
  }, [range?.start, range?.end, range?.preset, settings?.till, user?.id, user?._id]);

  useEffect(() => {
    void loadData();
    const id = setInterval(() => void loadData(), 60_000);
    return () => clearInterval(id);
  }, [loadData]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading shift summary...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto mt-12 max-w-md">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={loadData}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const s = summary ?? null;
  const rangeLabel = range?.preset === 'today' ? 'Today' : 'Shift';

  if (!s) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">No shift data available</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Header */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shift Summary</h1>
          <p className="text-sm text-muted-foreground">{rangeLabel} · {new Date().toLocaleTimeString()}</p>
        </div>
        <Button variant="outline" size="icon-sm" onClick={loadData} aria-label="Refresh">
          <RotateCcw className="size-4" />
        </Button>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2">
        <Card>
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <DollarSign className="size-4" />
              </span>
              <div>
                <span className="text-sm font-normal text-muted-foreground">Sales</span>
                <div className="text-2xl font-bold leading-none tracking-tight">{fmt(s.sales)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <ShoppingCart className="size-4" />
              </span>
              <div>
                <span className="text-sm font-normal text-muted-foreground">Orders</span>
                <div className="text-2xl font-bold leading-none tracking-tight">{s.orders}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <DollarSign className="size-4" />
              </span>
              <div>
                <span className="text-sm font-normal text-muted-foreground">AOV</span>
                <div className="text-2xl font-bold leading-none tracking-tight">{fmt(s.aov)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${s.heldOrdersCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                <Inbox className="size-4" />
              </span>
              <div>
                <span className="text-sm font-normal text-muted-foreground">Held Orders</span>
                <div className="text-2xl font-bold leading-none tracking-tight">{s.heldOrdersCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Split */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" />
            Payment Split
          </CardTitle>
          <p className="text-xs text-muted-foreground">How customers paid</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-3">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{fmt(s.paymentSplit.cash)}</div>
              <div className="text-xs text-muted-foreground">Cash</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{fmt(s.paymentSplit.card)}</div>
              <div className="text-xs text-muted-foreground">Card</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{fmt(s.paymentSplit.mobile)}</div>
              <div className="text-xs text-muted-foreground">Mobile</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Button
            onClick={onNewSale}
            className="h-20 flex-col gap-2 text-left"
            size="lg"
          >
            <PlusCircle className="size-6 text-green-600" />
            <span className="font-medium">New Sale</span>
            <span className="text-xs text-muted-foreground">Start a new order</span>
          </Button>
          <Button
            onClick={onHeldOrders}
            variant="outline"
            className="h-20 flex-col gap-2 text-left"
            size="lg"
          >
            <Inbox className={s.heldOrdersCount > 0 ? 'size-6 text-amber-600' : 'size-6 text-muted-foreground'} />
            <span className="font-medium">Held Orders</span>
            <span className="text-xs text-muted-foreground">
              {s.heldOrdersCount > 0 ? `${s.heldOrdersCount} waiting` : 'None'}
            </span>
          </Button>
          <Button
            onClick={onEndShift}
            variant="outline"
            className="h-20 flex-col gap-2 text-left"
            size="lg"
          >
            <LogOut className="size-6 text-red-600" />
            <span className="font-medium">End Shift</span>
            <span className="text-xs text-muted-foreground">Close drawer</span>
          </Button>
        </CardContent>
      </Card>

      {/* Drawer Status */}
      {drawerSession && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="size-4" />
              Cash Drawer
            </CardTitle>
            <p className="text-xs text-muted-foreground">Current session status</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Float</p>
                <p className="font-medium">{fmt(drawerSession.floatAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Counted</p>
                <p className="font-medium">{drawerSession.countedCash ? fmt(drawerSession.countedCash) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Opened</p>
                <p className="font-medium text-xs">{new Date(drawerSession.openedAt).toLocaleTimeString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Variance</p>
                <p className={`font-medium ${drawerSession.variance !== null && drawerSession.variance !== 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  {drawerSession.variance !== null ? fmt(drawerSession.variance) : '—'}
                </p>
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground text-center">
              Use "End Shift" to close the drawer and complete reconciliation
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}