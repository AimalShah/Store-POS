import { useEffect, useState } from 'react';
import { api, Shift, XReport, ZReport, Settings } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { AlertCircle, Banknote, CreditCard, Smartphone, Calculator, ReceiptText } from 'lucide-react';

type Props = {
  settings: Settings | null;
  onShiftChange: () => void;
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

export default function ShiftView({ settings, onShiftChange }: Props) {
  const { user, hasPerm } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [floatAmount, setFloatAmount] = useState('');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [xReport, setXReport] = useState<XReport | null>(null);
  const [zReport, setZReport] = useState<ZReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const symbol = settings?.symbol || '$';
  const till = settings?.till || 1;

  const loadShifts = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getShifts({ status: 'open', till });
      if (list.length === 0) {
        const closedList = await api.getShifts({ status: 'closed', till, limit: 20 });
        setShifts(closedList);
      } else {
        setShifts(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const handleOpenShift = async () => {
    const float = parseFloat(floatAmount) || 0;
    if (float < 0) return;

    setError(null);
    setLoading(true);
    try {
      await api.openShift({ floatAmount: float, till });
      setOpenShiftDialog(false);
      setFloatAmount('');
      await loadShifts();
      onShiftChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open shift');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (shift: Shift) => {
    const countedCash = window.prompt(`Enter counted cash amount for shift #${shift.id}:`, String(shift.floatAmount + (shift.xReport?.cashSales || 0)));
    if (countedCash === null) return;

    const cash = parseFloat(countedCash);
    if (isNaN(cash) || cash < 0) {
      setError('Invalid cash amount');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await api.closeShift(shift.id, { countedCash: cash });
      await loadShifts();
      onShiftChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close shift');
    } finally {
      setLoading(false);
    }
  };

  const handleViewXReport = async (shift: Shift) => {
    setSelectedShift(shift);
    setReportLoading(true);
    try {
      const report = await api.getXReport(shift.id);
      setXReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load X report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleViewZReport = async (shift: Shift) => {
    setSelectedShift(shift);
    setReportLoading(true);
    try {
      const report = await api.getZReport(shift.id);
      setZReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Z report');
    } finally {
      setReportLoading(false);
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
          <h1 className="text-2xl font-bold">Shifts</h1>
          <p className="text-muted-foreground">Manage cash shifts, view X/Z reports, and reconcile cash</p>
        </div>
        {hasPerm('perm_transactions') && (
          <Button onClick={() => setOpenShiftDialog(true)} disabled={shifts.some((s) => s.status === 'open')}>
            + Open Shift
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2" role="alert">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {shifts.length === 0 && !loading && (
        <EmptyState
          title="No shifts yet"
          description="Open a shift with a starting float to begin taking payments."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Shifts for Till #{till}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead>Float</TableHead>
                <TableHead>Counted</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead className="w-64 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-mono text-sm">{shift.id}</TableCell>
                    <TableCell>{shift.userName}</TableCell>
                    <TableCell>{getStatusBadge(shift.status)}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(shift.openedAt)}</TableCell>
                    <TableCell className="text-sm">{shift.closedAt ? formatDateTime(shift.closedAt) : '—'}</TableCell>
                    <TableCell className="font-medium">{symbol}{shift.floatAmount.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">{shift.countedCash !== undefined ? `${symbol}${shift.countedCash.toFixed(2)}` : '—'}</TableCell>
                    <TableCell className="font-medium">
                      {shift.zReport && shift.zReport.difference !== undefined ? (
                        <span className={shift.zReport.difference >= 0 ? 'text-green-600' : 'text-destructive'}>
                          {shift.zReport.difference >= 0 ? '+' : ''}{symbol}{shift.zReport.difference.toFixed(2)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {shift.status === 'open' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleViewXReport(shift)} disabled={reportLoading}>
                              <ReceiptText className="size-3.5 mr-1.5" />
                              X Report
                            </Button>
                            <Button variant="default" size="sm" onClick={() => handleCloseShift(shift)}>
                              <Calculator className="size-3.5 mr-1.5" />
                              Close Shift
                            </Button>
                          </>
                        )}
                        {shift.status === 'closed' && (
                          <Button variant="outline" size="sm" onClick={() => handleViewZReport(shift)} disabled={reportLoading}>
                            <ReceiptText className="size-3.5 mr-1.5" />
                            Z Report
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

      {/* Open Shift Dialog */}
      <Dialog open={openShiftDialog} onOpenChange={setOpenShiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open New Shift</DialogTitle>
            <DialogDescription>
              Enter the starting cash float for Till #{till}. The shift must be opened before taking payments.
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
            <Button variant="outline" onClick={() => setOpenShiftDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleOpenShift} disabled={loading || !floatAmount.trim()}>
              {loading ? 'Opening...' : 'Open Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* X Report Dialog */}
      <Dialog open={!!xReport} onOpenChange={(open) => !open && setXReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              X Report — Shift #{selectedShift?.id}
            </DialogTitle>
            <DialogDescription>
              Live snapshot of current shift sales (does not close the shift)
            </DialogDescription>
          </DialogHeader>
          {xReport && (
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calculator className="size-4" />
                      <span>Total Sales</span>
                    </div>
                    <div className="text-2xl font-bold text-primary">{symbol}{xReport.totalSales.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ReceiptText className="size-4" />
                      <span>Transactions</span>
                    </div>
                    <div className="text-2xl font-bold">{xReport.transactionCount}</div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Banknote className="size-4 text-green-600" />
                      Cash Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{symbol}{xReport.cashSales.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="size-4 text-blue-600" />
                      Card Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{symbol}{xReport.cardSales.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Smartphone className="size-4 text-purple-600" />
                      Mobile Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{symbol}{xReport.mobileSales.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              {xReport.refundCount > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="bg-destructive/10 border-destructive/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                        <AlertCircle className="size-4" />
                        Refunds
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Count:</span>
                          <span className="ml-2 font-medium">{xReport.refundCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>
                          <span className="ml-2 font-medium">{symbol}{xReport.refundTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => window.print()}>
                  <ReceiptText className="size-3.5 mr-1.5" />
                  Print Report
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Z Report Dialog */}
      <Dialog open={!!zReport} onOpenChange={(open) => !open && setZReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Z Report — Shift #{selectedShift?.id} (Closed)
            </DialogTitle>
            <DialogDescription>
              Final reconciliation report for the closed shift
            </DialogDescription>
          </DialogHeader>
          {zReport && (
            <div className="space-y-4 py-4">
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calculator className="size-4" />
                      <span>Total Sales</span>
                    </div>
                    <div className="text-2xl font-bold text-primary">{symbol}{zReport.totalSales.toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Banknote className="size-4 text-green-600" />
                      Cash Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{symbol}{zReport.cashSales.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="size-4 text-blue-600" />
                      Card Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{symbol}{zReport.cardSales.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Smartphone className="size-4 text-purple-600" />
                      Mobile Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{symbol}{zReport.mobileSales.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <Card className={zReport.difference >= 0 ? 'bg-green-50 border-green-200' : 'bg-destructive/10 border-destructive/20'}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calculator className="size-4" />
                    Cash Reconciliation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Starting Float:</span>
                      <div className="font-medium">{symbol}{selectedShift?.floatAmount.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cash Sales:</span>
                      <div className="font-medium text-green-600">{symbol}{zReport.cashSales.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expected Cash:</span>
                      <div className="font-medium">{symbol}{zReport.expectedCash.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Counted Cash:</span>
                      <div className="font-medium">{symbol}{zReport.actualCash.toFixed(2)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Difference:</span>
                      <div className={`font-bold text-xl ${zReport.difference >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {zReport.difference >= 0 ? '+' : ''}{symbol}{zReport.difference.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => window.print()}>
                  <ReceiptText className="size-3.5 mr-1.5" />
                  Print Z Report
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}