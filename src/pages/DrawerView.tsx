import { useEffect, useState } from 'react';
import { api, Settings, Transaction } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { highlight } from '../lib/highlight';
import { AlertCircle, Calculator, Banknote, ReceiptText } from 'lucide-react';

type Props = {
  settings: Settings | null;
  onDrawerChange: () => void;
};

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function DrawerView({ settings, onDrawerChange }: Props) {
  const { user, hasPerm } = useAuth();
  const [sessions, setSessions] = useState<{ id: number; till: number; floatAmount: number; countedCash: number; variance: number; status: string; openedAt: string; closedAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDrawerDialog, setOpenDrawerDialog] = useState(false);
  const [floatAmount, setFloatAmount] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [selectedSession, setSelectedSession] = useState<{ id: number; till: number; floatAmount: number; countedCash: number; variance: number; status: string; openedAt: string; closedAt: string } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const symbol = settings?.symbol || 'Rs';
  const till = settings?.till || 1;

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getDrawerSessions({ status: undefined, till });
      const mapped = list.map((session) => ({
        id: session.id,
        till: session.till,
        floatAmount: session.float_amount,
        countedCash: session.counted_cash,
        variance: session.variance,
        status: session.status,
        openedAt: session.opened_at,
        closedAt: session.closed_at,
      }));
      setSessions(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drawer sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [till]);

  const handleOpenDrawer = async () => {
    const float = parseFloat(floatAmount) || 0;
    if (float < 0) return;

    setError(null);
    setLoading(true);
    try {
      await api.openDrawerSession({ floatAmount: float, till });
      setOpenDrawerDialog(false);
      setFloatAmount('');
      await loadSessions();
      onDrawerChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open drawer');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDrawer = (session: { id: number; till: number; floatAmount: number; countedCash: number; variance: number; status: string; openedAt: string; closedAt: string }) => {
    setSelectedSession(session);
    setCountedCash(String(session.floatAmount + (session.variance || 0)));
  };

  const confirmCloseDrawer = async () => {
    if (!selectedSession) return;
    const cash = parseFloat(countedCash);
    if (isNaN(cash) || cash < 0) {
      setError('Invalid cash amount');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await api.closeDrawerSession(selectedSession.id, { countedCash: cash });
      setSelectedSession(null);
      setCountedCash('');
      await loadSessions();
      onDrawerChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close drawer');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === 'open' ? 'secondary' : 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Drawer Reconciliation</h1>
          <p className="text-muted-foreground">Manage cash drawer open/close counts and view variance</p>
        </div>
        {hasPerm('perm_transactions') && (
          <Button onClick={() => setOpenDrawerDialog(true)}>
            + Open Drawer
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2" role="alert">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {sessions.length === 0 && !loading && (
        <EmptyState
          title="No drawer sessions yet"
          description="Open a drawer with a starting float to begin cash reconciliation."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Drawer Sessions for Till #{till}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Float</TableHead>
                <TableHead>Counted</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead className="w-64 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-mono text-sm">{session.id}</TableCell>
                    <TableCell>{session.status === 'open' ? 'Cashier' : 'Unknown'}</TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell className="font-medium"><span className={highlight.blue}>{symbol}{session.floatAmount.toFixed(2)}</span></TableCell>
                    <TableCell className="font-medium"><span className={highlight.blue}>{session.countedCash != null ? `${symbol}${session.countedCash.toFixed(2)}` : '—'}</span></TableCell>
                    <TableCell className="font-medium">
                      {session.variance !== undefined ? (
                        <span className={session.variance >= 0 ? highlight.green : highlight.red}>
                          {session.variance >= 0 ? '+' : ''}{symbol}{session.variance.toFixed(2)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {session.status === 'open' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleCloseDrawer(session)}>
                              <Calculator className="size-3.5 mr-1.5" />
                              Close Drawer
                            </Button>
                          </>
                        )}
                        {session.status === 'closed' && (
                          <Button variant="outline" size="sm" onClick={() => handleCloseDrawer(session)}>
                            <ReceiptText className="size-3.5 mr-1.5" />
                            View Z Report
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Open Drawer Dialog */}
      <Dialog open={openDrawerDialog} onOpenChange={setOpenDrawerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open New Drawer</DialogTitle>
            <DialogDescription>
              Enter the starting cash float for Till #{till}. The drawer must be opened before taking payments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="float-amount">Starting Float ({symbol})</Label>
              <Input
                id="float-amount"
                type="number"
                step="0.01"
                min={0}
                value={floatAmount}
                onChange={(e) => setFloatAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <p className="text-sm text-muted-foreground">
              The float is the starting cash in the drawer. All cash sales will be added to this amount.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDrawerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleOpenDrawer} disabled={loading || !floatAmount.trim()}>
              {loading ? 'Opening...' : 'Open Drawer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Drawer Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Drawer #{selectedSession?.id}</DialogTitle>
            <DialogDescription>
              Enter the counted cash in the drawer to reconcile against expected cash.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="counted-cash">Counted Cash ({symbol})</Label>
            <Input
              id="counted-cash"
              type="number"
              step="0.01"
              min={0}
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSession(null)}>
              Cancel
            </Button>
            <Button onClick={confirmCloseDrawer} disabled={loading || !countedCash.trim()}>
              {loading ? 'Closing...' : 'Close Drawer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}