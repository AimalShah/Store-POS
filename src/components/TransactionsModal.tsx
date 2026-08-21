import { useEffect, useState } from 'react';
import { Filter, Loader2, Printer, Trash2, AlertTriangle } from 'lucide-react';
import { api, Settings, Transaction, User } from '../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { highlight } from '../lib/highlight';
import { printReportPdf } from '../lib/printing';
import { buildInvoicePdf } from '../lib/reportPdf';
import Invoice from './Invoice';

type Props = {
  open?: boolean;
  embedded?: boolean;
  onClose: () => void;
  users?: User[];
  symbol: string;
  settings: Settings | null;
};

/** Format a Date for <input type="datetime-local"> in local time. */
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local value as local time → ISO UTC for the API. */
function localInputToIso(value: string, endOfMinute = false) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  if (endOfMinute) d.setSeconds(59, 999);
  return d.toISOString();
}

function defaultRange() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 0, 0);
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) };
}

export default function TransactionsModal({
  open = true,
  embedded = false,
  onClose,
  symbol,
  settings,
}: Props) {
  const initial = defaultRange();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [userId, setUserId] = useState<string>('0');
  const [till, setTill] = useState<string>('0');
  const [status, setStatus] = useState<string>('1');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<Transaction | null>(null);
  const [voidTx, setVoidTx] = useState<Transaction | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [list, allUsers] = await Promise.all([
        api.getByDate({
          start: localInputToIso(start),
          end: localInputToIso(end, true),
          user: Number(userId),
          till: Number(till),
          status: Number(status),
        }),
        api.getUsers().catch(() => [] as User[]),
      ]);
      setRows(list);
      setUsers(allUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async (tx: Transaction) => {
    if (!confirm('Void this order? Stock will be restored. This action cannot be undone.')) return;
    setVoidLoading(true);
    setError(null);
    try {
      await api.request(`/api/transactions/${tx.id}/void`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Void failed');
    } finally {
      setVoidLoading(false);
    }
  };

  useEffect(() => {
    if (open || embedded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on open; Filter button refreshes
  }, [open, embedded]);

  const body = (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="tx-from">From</Label>
          <Input
            id="tx-from"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tx-to">To</Label>
          <Input
            id="tx-to"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Cashier</Label>
          <Select value={userId} onValueChange={(v) => setUserId(v ?? '0')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.fullname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tx-till">Till</Label>
          <Input
            id="tx-till"
            type="number"
            min={0}
            className="w-[100px]"
            value={till}
            onChange={(e) => setTill(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? '1')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Paid</SelectItem>
              <SelectItem value="0">Unpaid / Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="outline" size="icon" aria-label="Filter" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Filter className="size-4" />}
              </Button>
            }
          />
          <TooltipContent>Filter</TooltipContent>
        </Tooltip>
      </div>

      {rows.length === 0 && !loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No transactions in this range
        </p>
      ) : loading ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Till</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Till</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{new Date(r.date).toLocaleString()}</TableCell>
                <TableCell>{r.user}</TableCell>
                <TableCell>{r.till}</TableCell>
                <TableCell>{r.customer_name}</TableCell>
                <TableCell className="text-right">
                  <span className={highlight.green}>{symbol}{Number(r.total).toFixed(2)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={highlight.blue}>{symbol}{Number(r.paid).toFixed(2)}</span>
                </TableCell>
                <TableCell>
                  {r.status === 1 ? (
                    <Badge>Paid</Badge>
                  ) : r.status === 2 ? (
                    <Badge variant="destructive">Voided</Badge>
                  ) : (
                    <Badge variant="secondary">Open</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.status === 1 && (
                    <>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button variant="outline" size="icon" aria-label="Print invoice" onClick={() => setInvoice(r)}>
                              <Printer className="size-4" />
                            </Button>
                          }
                        />
                        <TooltipContent>Print invoice</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="destructive"
                              size="icon"
                              aria-label="Void transaction"
                              onClick={() => handleVoid(r)}
                              disabled={voidLoading}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          }
                        />
                        <TooltipContent>Void transaction</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  {r.status === 2 && (
                    <span className="text-xs text-muted-foreground">Voided</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  const invoiceDialog = (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && setInvoice(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invoice</DialogTitle>
        </DialogHeader>
        {invoice && <Invoice tx={invoice} settings={settings} symbol={symbol} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setInvoice(null)}>
            Close
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Print invoice"
                  onClick={() =>
                    invoice && printReportPdf(buildInvoicePdf({ settings, tx: invoice }))
                  }
                >
                  <Printer className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Print invoice</TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (embedded) {
    return (
      <>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Transactions</CardTitle>
            <Button variant="outline" onClick={onClose}>
              Back to dashboard
            </Button>
          </CardHeader>
          <CardContent>{body}</CardContent>
        </Card>
        {invoiceDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Transactions</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
      {invoiceDialog}
    </>
  );
}
