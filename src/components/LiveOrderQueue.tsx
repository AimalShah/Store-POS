import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { api, type Transaction } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export function LiveOrderQueue({
  symbol,
  onResume,
}: {
  symbol: string;
  onResume?: (order: Transaction) => void;
}) {
  const [orders, setOrders] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());

  const load = useCallback(async () => {
    try {
      const held = await api.getOnHold().catch(() => [] as Transaction[]);
      setOrders(held);
    } finally {
      setLoading(false);
      setUpdatedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const total = orders.reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed className="size-4 text-primary" />
          Live Orders
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{orders.length} active · {symbol}{total.toFixed(2)}</span>
          <Button variant="ghost" size="icon-sm" onClick={load} disabled={loading} title="Refresh">
            <Loader2 className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && orders.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading live orders…</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShoppingBag className="size-5" />
            </div>
            <p className="text-sm font-medium">No live orders</p>
            <p className="text-xs text-muted-foreground">Held and in-progress orders will appear here.</p>
          </div>
        ) : (
          <ScrollArea className="h-56">
            <ul className="flex flex-col gap-2 pr-2">
              {orders.map((o) => (
                <li key={o._id}>
                  <button
                    type="button"
                    onClick={() => onResume?.(o)}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <UtensilsCrossed className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {o.customer_name || 'Walk-in'}
                        </span>
                        <Badge variant="secondary">Held</Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {timeAgo(o.date)}
                        <span>·</span>
                        <span>{o.items.length} items</span>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{symbol}{Number(o.total || 0).toFixed(2)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
