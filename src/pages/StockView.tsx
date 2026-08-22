import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, EllipsisVertical, PackagePlus, PackageX, Pencil, Plus, Trash2, Utensils, RefreshCw, BarChart3, Download, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { api, Ingredient, StockEntry, UNITS, Unit } from '../api/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { Calendar as CalendarPicker } from '../components/ui/calendar';
import { localInputToIso, monthRange } from '../lib/dates';
import { downloadCsv } from '../lib/export';

const emptyIngredient: { id: string; name: string; unit: Unit; costPerUnit: string } = {
  id: '',
  name: '',
  unit: 'kg',
  costPerUnit: '',
};

export default function StockView({ 
  symbol = 'Rs',
  initialFilter,
}: { 
  symbol?: string;
  initialFilter?: 'low' | 'out';
}) {
  const [list, setList] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restock tab
  const [restockId, setRestockId] = useState('');
  const [restockQty, setRestockQty] = useState('');
  const [restockNote, setRestockNote] = useState('');
  const [restockPaid, setRestockPaid] = useState('');
  const [restocking, setRestocking] = useState(false);

  // Manage tab
  const [form, setForm] = useState(emptyIngredient);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);

  // Deduction dialog (usage / wastage)
  const [deductTarget, setDeductTarget] = useState<Ingredient | null>(null);
  const [deductType, setDeductType] = useState<'usage' | 'wastage'>('usage');
  const [deductQty, setDeductQty] = useState('');
  const [deductNote, setDeductNote] = useState('');
  const [deducting, setDeducting] = useState(false);

  // At-a-glance cards
  const [summary, setSummary] = useState<{ items: number; outOfStock: number; changesToday: number; stockWorth: number; spentTotal: number } | null>(null);

  // Movements history
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [filterIngredient, setFilterIngredient] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

  // Stock list filter (for manage tab)
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>(initialFilter ?? 'all');

  // Report tab
  const initialRange = monthRange();
  const [reportFrom, setReportFrom] = useState(initialRange.start);
  const [reportTo, setReportTo] = useState(initialRange.end);
  const [reportDateRangeOpen, setReportDateRangeOpen] = useState(false);
  const [reportData, setReportData] = useState<{
    productName: string;
    unit: string;
    restocks: number;
    sales: number;
    wastage: number;
    adjustments: number;
    theoretical: number;
    actual: number;
    variance: number;
    sellThrough: number;
    daysOfStock: number;
  }[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.getIngredients();
      setList(rows);
      try {
        const sum = await api.getStockSummary();
        setSummary(sum);
      } catch {
        // Summary endpoint might not exist, use fallback
        setSummary({
          items: rows.length,
          outOfStock: rows.filter((i) => i.balance <= 0).length,
          changesToday: 0,
          stockWorth: rows.reduce((s, i) => s + i.value, 0),
          spentTotal: 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load ingredients');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const res = await api.getStockEntries({
        ingredientId: filterIngredient !== 'all' ? Number(filterIngredient) : undefined,
        type: filterType !== 'all' ? filterType : undefined,
        startDate: filterFrom || undefined,
        endDate: filterTo ? `${filterTo}T23:59:59.999Z` : undefined,
      });
      setEntries(res.entries);
    } catch {
      /* ignore */
    }
  }, [filterIngredient, filterType, filterFrom, filterTo]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await api.getStockEntries({
        startDate: localInputToIso(reportFrom),
        endDate: localInputToIso(reportTo, true),
      });
      const entries = res.entries;

      // Aggregate by ingredient
      const byIngredient = new Map<number, {
        name: string;
        unit: string;
        restocks: number;
        sales: number;
        wastage: number;
        adjustments: number;
      }>();

      for (const e of entries) {
        const key = e.ingredientId;
        const existing = byIngredient.get(key) || {
          name: e.ingredientName || `Ingredient ${e.ingredientId}`,
          unit: e.unit || 'pcs',
          restocks: 0,
          sales: 0,
          wastage: 0,
          adjustments: 0,
        };
        const qty = Number(e.quantity);
        switch (e.type) {
          case 'restock':
            existing.restocks += qty;
            break;
          case 'usage':
            existing.sales += qty;
            break;
          case 'wastage':
            existing.wastage += qty;
            break;
        }
        byIngredient.set(key, existing);
      }

      // Calculate theoretical, actual, variance, sell-through, days of stock
      const reportRows = [];
      for (const [ingredientId, data] of byIngredient) {
        const ingredient = list.find((i) => i.id === ingredientId);
        const actual = ingredient?.balance ?? 0;
        const theoretical = data.restocks - data.sales - data.wastage - data.adjustments;
        const variance = actual - theoretical;
        const totalOut = data.sales + data.wastage + data.adjustments;
        const sellThrough = totalOut > 0 ? (data.sales / totalOut) * 100 : 0;
        const dailyRate = totalOut / Math.max(1, (new Date(reportTo).getTime() - new Date(reportFrom).getTime()) / 86400000 + 1);
        const daysOfStock = dailyRate > 0 ? actual / dailyRate : 0;

        reportRows.push({
          productName: data.name,
          unit: data.unit,
          restocks: data.restocks,
          sales: data.sales,
          wastage: data.wastage,
          adjustments: data.adjustments,
          theoretical: Math.round(theoretical * 100) / 100,
          actual: Math.round(actual * 100) / 100,
          variance: Math.round(variance * 100) / 100,
          sellThrough: Math.round(sellThrough * 10) / 10,
          daysOfStock: Math.round(daysOfStock * 10) / 10,
        });
      }

      setReportData(reportRows);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setReportLoading(false);
    }
  }, [reportFrom, reportTo, list]);

  const exportReport = useCallback(() => {
    if (!reportData.length) return;
    const header = [
      'Product',
      'Unit',
      'Received',
      'Sold',
      'Wasted',
      'Adjusted',
      'Should Be Left',
      'Actually Left',
      'Difference',
      '% Sold',
      'Days Left',
    ];
    const rows = reportData.map((r) => [
      r.productName,
      r.unit,
      r.restocks,
      r.sales,
      r.wastage,
      r.adjustments,
      r.theoretical,
      r.actual,
      r.variance,
      r.sellThrough,
      r.daysOfStock === Infinity || r.daysOfStock > 999 ? '∞' : r.daysOfStock,
    ]);
    downloadCsv(`stock-report-${reportFrom}-to-${reportTo}.csv`, header, rows);
  }, [reportData, reportFrom, reportTo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => {
      void load();
      void loadEntries();
      setUpdatedAt(Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, [load, loadEntries]);

  const selected = useMemo(
    () => list.find((i) => i.id === Number(restockId)) || null,
    [list, restockId]
  );

  const restockQtyNum = Number(restockQty) || 0;
  const paidTotal = Number(restockPaid) || 0;

  const restock = async () => {
    if (!selected || !Number(restockQty) || !paidTotal) return;
    setRestocking(true);
    try {
      await api.restock({
        ingredientId: selected.id,
        quantity: Number(restockQty),
        paid: paidTotal,
        note: restockNote.trim(),
      });
      toast.success(
        `Added ${Number(restockQty)} ${selected.unit} of ${selected.name}. You paid ${symbol}${paidTotal.toFixed(2)}.`
      );
      setRestockQty('');
      setRestockPaid('');
      setRestockNote('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restock failed');
    } finally {
      setRestocking(false);
    }
  };

  const saveIngredient = async () => {
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const costPerUnit = Number(form.costPerUnit) || 0;
      if (form.id) {
        await api.updateIngredient(Number(form.id), { name: form.name.trim(), unit: form.unit, costPerUnit });
        toast.success('Item updated.');
      } else {
        await api.createIngredient({ name: form.name.trim(), unit: form.unit as Unit, costPerUnit });
        toast.success('Item added.');
      }
      setForm(emptyIngredient);
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setForm(emptyIngredient);
    setFormError(null);
    setFormOpen(true);
  };

  const editIngredient = (i: Ingredient) => {
    setForm({ id: String(i.id), name: i.name, unit: i.unit, costPerUnit: String(i.costPerUnit ?? '') });
    setFormError(null);
    setFormOpen(true);
  };

  const openDeduct = (i: Ingredient, type: 'usage' | 'wastage') => {
    setDeductTarget(i);
    setDeductType(type);
    setDeductQty('');
    setDeductNote('');
  };

  const submitDeduction = async () => {
    if (!deductTarget || !Number(deductQty)) return;
    if (deductType === 'wastage' && !deductNote.trim()) return;
    setDeducting(true);
    try {
      await api.logUsage({
        ingredientId: deductTarget.id,
        quantity: Number(deductQty),
        type: deductType,
        note: deductNote.trim(),
      });
      toast.success(
        `${Number(deductQty)} ${deductTarget.unit} of ${deductTarget.name} ` +
          (deductType === 'wastage' ? `marked as wasted (${deductNote.trim()}).` : 'marked as used.')
      );
      setDeductTarget(null);
      await Promise.all([load(), loadEntries()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not log entry');
    } finally {
      setDeducting(false);
    }
  };

  const remove = async (i: Ingredient) => {
    try {
      await api.deleteIngredient(i.id);
      toast.success(`${i.name} removed from the list.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove this item');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            Keep track of your stock by hand. Selling items does not change these numbers.
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
                <Button variant="outline" size="icon-sm" className="ml-1" aria-label="Refresh" onClick={() => { void load(); void loadEntries(); setUpdatedAt(Date.now()); }}>
                  <RefreshCw className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="size-4" />
          {error}
          <Button variant="ghost" size="sm" onClick={() => { setError(null); void load(); }}>
            Retry
          </Button>
        </div>
      )}

      {/* At-a-glance cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-col items-center justify-between gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <PackagePlus className="size-4 text-primary" />
              </span>
              <p className="text-sm text-semibold text-muted-foreground">Items in stock</p>
            </div>
            <p className="text-3xl font-bold leading-none tabular-nums text-center">{summary?.items ?? list.length}</p>
          </CardContent>
        </Card>

        <Card
          className={
            (summary?.outOfStock ?? 0) > 0
              ? 'border-destructive/40 bg-destructive/5'
              : undefined
          }
        >
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-col items-center justify-between gap-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  (summary?.outOfStock ?? 0) > 0 ? 'bg-destructive/15' : 'bg-muted'
                }`}
              >
                <PackageX
                  className={`size-4 ${(summary?.outOfStock ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
                />
              </span>
              <p className="text-sm text-semibold text-muted-foreground">Nothing left</p>
            </div>
            <p className="text-3xl font-bold leading-none tabular-nums text-center">
              {summary?.outOfStock ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-col items-center justify-between gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <Utensils className="size-4 text-blue-700" />
              </span>
              <span className="text-sm text-semibold text-muted-foreground">Value on hand</span>
            </div>
            <p className="text-3xl font-bold leading-none tabular-nums text-center">{symbol}{(summary?.stockWorth ?? list.reduce((total, item) => total + Number(item.value || 0), 0)).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

<Tabs defaultValue="restock">
        <TabsList variant="line" className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="restock" className="flex-none px-1 pb-2.5 pt-2 data-active:after:bg-primary">
            Add Stock
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex-none px-1 pb-2.5 pt-2 data-active:after:bg-primary">
            Stock list
          </TabsTrigger>
          <TabsTrigger value="report" className="flex-none px-1 pb-2.5 pt-2 data-active:after:bg-primary">
            Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="restock" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add stock you received</CardTitle>
              <CardDescription>
                The amount is added right away, and your name is saved with it.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="restock-ingredient">Item</Label>
                  <Select value={restockId} onValueChange={(v) => setRestockId(v ?? '')}>
                    <SelectTrigger id="restock-ingredient" className="w-full">
                      <SelectValue placeholder="Pick an item" />
                    </SelectTrigger>
                    <SelectContent>
                      {list.map((i) => (
                        <SelectItem key={i.id} value={String(i.id)}>
                          {i.name} ({i.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="restock-qty">Quantity{selected ? ` (${selected.unit})` : ''}</Label>
                  <Input
                    id="restock-qty"
                    type="number"
                    step="0.01"
                    min={0}
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="restock-paid">Total price ({symbol})</Label>
                  <Input
                    id="restock-paid"
                    type="number"
                    step="0.01"
                    min={0}
                    value={restockPaid}
                    onChange={(e) => setRestockPaid(e.target.value)}
                    placeholder="Total price"
                  />
                  {restockQtyNum > 0 && restockPriceNum > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Per unit: {symbol}{(paidTotal / restockQtyNum).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="restock-note">Note (optional)</Label>
                <Input
                  id="restock-note"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  placeholder="e.g. Friday supplier delivery"
                />
              </div>
              <Button
                type="button"
                onClick={restock}
                disabled={restocking || !selected || !Number(restockQty) || !Number(restockPaid)}
                className="w-fit"
              >
                <PackagePlus className="size-4" />
                {restocking ? 'Saving…' : 'Add Stock'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

<TabsContent value="manage" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="text-base">What We Have</CardTitle>
                <CardDescription>How much of each item is left right now.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as 'all' | 'low' | 'out')}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="All stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stock</SelectItem>
                    <SelectItem value="low">Low stock</SelectItem>
                    <SelectItem value="out">Out of stock</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus className="size-4" />
                  Add New Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
              ) : list.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No items yet. Tap "Add New Item" to start.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount left</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Last Change</TableHead>
                      <TableHead className="w-12 text-right" aria-label="Actions" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list
                      .filter((i) => {
                        if (stockFilter === 'low') return isLowStock(i) && i.balance > 0;
                        if (stockFilter === 'out') return i.balance <= 0;
                        return true;
                      })
                      .map((i) => {
                      const outOfStock = i.balance <= 0;
                      return (
                      <TableRow key={i.id} className={outOfStock ? 'bg-destructive/5' : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{i.name}</span>
                            {outOfStock && (
                              <Badge variant="destructive" className="text-xs">
                                Out of stock
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm font-medium tabular-nums">
                            {Number(i.balance).toFixed(2)} {i.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {i.costPerUnit > 0 ? (
                            `${symbol}${Number(i.costPerUnit).toFixed(2)} / ${i.unit}`
                          ) : (
                            <Badge variant="secondary" className="text-xs font-normal">
                              Not set
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs">
                          {i.lastEntry ? (
                            <Badge variant="outline" className="gap-1">
                              {i.lastEntry.type === 'restock' ? (
                                <>
                                  <PackagePlus className="size-3" />
                                  Added
                                </>
                              ) : i.lastEntry.type === 'usage' ? (
                                <>
                                  <Utensils className="size-3" />
                                  Used
                                </>
                              ) : (
                                <>
                                  <PackageX className="size-3" />
                                  Wasted
                                </>
                              )}
                              <span className="text-muted-foreground">· by {i.lastEntry.userName}</span>
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Not stocked yet
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${i.name}`}
                              >
                                <EllipsisVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openDeduct(i, 'usage')}>
                                <Utensils className="size-4" /> Mark used
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => openDeduct(i, 'wastage')}>
                                <PackageX className="size-4" /> Mark wasted
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => editIngredient(i)}>
                                <Pencil className="size-4" /> Edit item
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(i)}>
                                <Trash2 className="size-4" /> Delete item
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock History</CardTitle>
              <CardDescription>Everything added, used or wasted — who did it, when, and how much.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterIngredient} onValueChange={(v) => setFilterIngredient(v ?? 'all')}>
                  <SelectTrigger
                    aria-label="Pick an item"
                    className="h-9 w-[160px] shrink-0"
                  >
                    <SelectValue placeholder="All items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All items</SelectItem>
                    {list.map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={(v) => setFilterType(v ?? 'all')}>
                  <SelectTrigger aria-label="What to show" className="h-9 w-[140px] shrink-0">
                    <SelectValue placeholder="Everything" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everything</SelectItem>
                    <SelectItem value="restock">Added</SelectItem>
                    <SelectItem value="usage">Used</SelectItem>
                    <SelectItem value="wastage">Wasted</SelectItem>
                  </SelectContent>
                </Select>
                <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-[280px] justify-start gap-2 text-left">
                      <CalendarIcon className="size-4" />
                      <span>
                        {filterFrom && filterTo
                          ? `${filterFrom} → ${filterTo}`
                          : filterFrom
                          ? `From ${filterFrom}`
                          : filterTo
                          ? `To ${filterTo}`
                          : 'Select date range'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" forceMount={dateRangeOpen}>
                    {dateRangeOpen && (
                      <div className="p-3">
                        <CalendarPicker
                          mode="range"
                          selected={{ start: filterFrom ? new Date(filterFrom) : undefined, end: filterTo ? new Date(filterTo) : undefined }}
                          onSelect={(range) => {
                            setFilterFrom(range.start ? range.start.toISOString().slice(0, 10) : '');
                            setFilterTo(range.end ? range.end.toISOString().slice(0, 10) : '');
                            setDateRangeOpen(false);
                          }}
                          initialFocus
                          numberOfMonths={2}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setFilterFrom(''); setFilterTo(''); setDateRangeOpen(false); }}>
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Note / reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">{e.ingredientName}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              e.type === 'restock'
                                ? 'bg-emerald-100 text-emerald-800'
                                : e.type === 'usage'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {e.type === 'restock' ? (
                              <PackagePlus className="size-3" />
                            ) : e.type === 'usage' ? (
                              <Utensils className="size-3" />
                            ) : (
                              <PackageX className="size-3" />
                            )}
                            {e.type === 'restock' ? 'Added' : e.type === 'usage' ? 'Used' : 'Wasted'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {e.type === 'restock' ? '+' : '−'}
                          {Number(e.quantity)} {e.unit}
                        </TableCell>
                        <TableCell>{e.userName}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {e.note || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
</Card>
          </TabsContent>

        <TabsContent value="report" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                Stock Report
              </CardTitle>
              <CardDescription>
                What came in, what went out, and what should be left — for each product in this date range.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <Popover open={reportDateRangeOpen} onOpenChange={setReportDateRangeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-[280px] justify-start gap-2 text-left">
                      <CalendarIcon className="size-4" />
                      <span>
                        {reportFrom && reportTo
                          ? `${reportFrom} → ${reportTo}`
                          : reportFrom
                          ? `From ${reportFrom}`
                          : reportTo
                          ? `To ${reportTo}`
                          : 'Select date range'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" forceMount={reportDateRangeOpen}>
                    {reportDateRangeOpen && (
                      <div className="p-3">
                        <CalendarPicker
                          mode="range"
                          selected={{ start: reportFrom ? new Date(reportFrom) : undefined, end: reportTo ? new Date(reportTo) : undefined }}
                          onSelect={(range) => {
                            setReportFrom(range.start ? range.start.toISOString().slice(0, 10) : '');
                            setReportTo(range.end ? range.end.toISOString().slice(0, 10) : '');
                            setReportDateRangeOpen(false);
                          }}
                          initialFocus
                          numberOfMonths={2}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setReportFrom(''); setReportTo(''); setReportDateRangeOpen(false); }}>
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <Button onClick={loadReport} disabled={reportLoading}>
                  {reportLoading ? 'Loading…' : 'Apply'}
                </Button>
                {reportData.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant="outline" size="icon" onClick={exportReport} disabled={reportLoading}>
                          <Download className="size-4" />
                        </Button>
                      }
                    />
                    <TooltipContent>Export CSV</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {reportError && (
                <div className="flex items-center gap-2 rounded-md border bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {reportError}
                </div>
              )}

              {reportLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Loading report…</div>
              ) : reportData.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No stock movements in this range.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                  <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                        <TableHead className="text-right">Wasted</TableHead>
                        <TableHead className="text-right">Adjusted</TableHead>
                        <TableHead className="text-right">Should Be Left</TableHead>
                        <TableHead className="text-right">Actually Left</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead className="text-right">% Sold</TableHead>
                        <TableHead className="text-right">Days Left</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((row, idx) => (
                        <TableRow key={idx} className={row.variance !== 0 ? 'bg-destructive/5' : undefined}>
                          <TableCell className="font-medium">{row.productName}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{row.restocks} {row.unit}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{row.sales} {row.unit}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{row.wastage} {row.unit}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{row.adjustments} {row.unit}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{row.theoretical} {row.unit}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{row.actual} {row.unit}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            <span className={row.variance < 0 ? 'text-destructive' : row.variance > 0 ? 'text-emerald-600' : ''}>
                              {row.variance >= 0 ? '+' : ''}{row.variance} {row.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{row.sellThrough}%</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {row.daysOfStock === Infinity || row.daysOfStock > 999 ? '∞' : row.daysOfStock}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>

      <AlertDialog
        open={!!deductTarget}
        onOpenChange={(o) => !o && setDeductTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deductType === 'usage' ? 'Mark as used' : 'Mark as wasted'} —{' '}
              {deductTarget?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have right now:{' '}
              <span className="font-medium text-foreground">
                {deductTarget ? `${Number(deductTarget.balance).toFixed(2)} ${deductTarget.unit}` : ''}
              </span>
              {deductType === 'wastage' && ' Please write why it was wasted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="deduct-qty">How much ({deductTarget?.unit})</Label>
              <Input
                id="deduct-qty"
                type="number"
                step="0.01"
                min={0}
                value={deductQty}
                onChange={(e) => setDeductQty(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deduct-note">
                {deductType === 'wastage' ? 'Reason (required)' : 'Note (optional)'}
              </Label>
              <Input
                id="deduct-note"
                value={deductNote}
                onChange={(e) => setDeductNote(e.target.value)}
                placeholder={
                  deductType === 'wastage' ? 'e.g. went bad, fell on the floor' : 'e.g. used for cooking'
                }
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitDeduction}
              disabled={
                deducting ||
                !Number(deductQty) ||
                (deductType === 'wastage' && !deductNote.trim())
              }
            >
              {deducting ? 'Saving…' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit item' : 'Add a new item'}</DialogTitle>
            <DialogDescription>
              Give it a name and pick how you count it — pieces, kilos, or litres.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ingredient-name">Item name</Label>
              <Input
                id="ingredient-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Dough"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ingredient-unit">Counted in</Label>
              <Select value={form.unit} onValueChange={(v) => v && setForm({ ...form, unit: v })}>
                <SelectTrigger id="ingredient-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ingredient-cost">Price for one ({symbol})</Label>
              <Input
                id="ingredient-cost"
                type="number"
                step="0.01"
                min={0}
                value={form.costPerUnit}
                onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                We use this to show how much your stock is worth.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveIngredient}
              disabled={saving || !form.name.trim() || !(Number(form.costPerUnit) > 0)}
            >
              {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Items with past stock records cannot be deleted — this keeps your history correct.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && remove(deleteTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
