import { useEffect, useState } from 'react';
import { api, DrawerSession, Settings, Transaction } from '../api/client';
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
  const { user, hasRole } = useAuth();
  const [sessions, setSessions] = useState<DrawerSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDrawerDialog, setOpenDrawerDialog] = useState(false);
  const [floatAmount, setFloatAmount] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [selectedSession, setSelectedSession] = useState<DrawerSession | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const symbol = settings?.symbol || 'Rs';
  const till = settings?.till || 1;

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getDrawerSessions({ status: undefined, till });
      setSessions(list);
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

  const handleCloseDrawer = (session: DrawerSession) => {
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
          <p className="text-muted-foreground">Count the money in the drawer at the start and end of the day.</p>
        </div>
        {hasRole('Admin', 'Manager') && (
          <Button onClick={() => setOpenDrawerDialog(true)}>
            Start Day — Open Drawer
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
          title="No drawer opened yet"
          description="Tap “Start Day” and enter the cash you put in the drawer."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Money Drawer — Till #{till}</CardTitle>
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              At closing, count the cash. More than expected = extra money (green). Less = money missing (red).
            </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Till</TableHead>
                <TableHead>Opened By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cash at Start</TableHead>
                <TableHead>Cash Counted</TableHead>
                <TableHead>Difference</TableHead>
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
                    <TableCell className="font-medium"><span className={highlight.blue}>{symbol}{Number(session.floatAmount ?? 0).toFixed(2)}</span></TableCell>
                    <TableCell className="font-medium"><span className={highlight.blue}>{session.countedCash != null ? `${symbol}${Number(session.countedCash).toFixed(2)}` : '—'}</span></TableCell>
                    <TableCell className="font-medium">
                      {session.variance != null ? (
                        <span className={session.variance >= 0 ? highlight.red : highlight.green}>
                          {session.variance === 0
                            ? 'Exact'
                            : session.variance > 0
                              ? `${symbol}${Number(session.variance).toFixed(2)} missing`
                              : `${symbol}${Math.abs(Number(session.variance)).toFixed(2)} extra`}
                        </span>
                      ) : (
                        'Not counted yet'
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
                            View Report
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
            <DialogTitle>Start the Day — Open Drawer</DialogTitle>
            <DialogDescription>
              How much cash are you putting in the drawer to start? You cannot take payments until the drawer is open.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="float-amount">Cash to start with ({symbol})</Label>
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
              This is the money in the drawer before any sales.
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
            <DialogTitle>End of Day — Close Drawer</DialogTitle>
            <DialogDescription>
              Count all the cash in the drawer and type the total below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="counted-cash">Total cash counted ({symbol})</Label>
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