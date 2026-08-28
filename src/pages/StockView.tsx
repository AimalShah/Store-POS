import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, EllipsisVertical, PackagePlus, PackageX, Pencil, Plus, Trash2, Utensils, RefreshCw, BarChart3, Download, Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Columns3, Search, X } from 'lucide-react';
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
import { localInputToIso, monthRange } from '../lib/dates';
import { downloadCsv } from '../lib/export';
import { DataTable, ColumnDef } from '../components/DataTable';
import { DateRangePicker, type PickerValue } from '../components/DateRangePicker';
import { buildDateRange } from '../lib/dateRange';
import { useLocale } from '../i18n/LocaleContext';
import { uiLocale, type Locale } from '../i18n/translations';

const emptyIngredient: { id: string; name: string; unit: Unit; costPerUnit: string } = {
  id: '',
  name: '',
  unit: 'kg',
  costPerUnit: '',
};

const DEFAULT_LOW_STOCK_THRESHOLD = 10;

function isLowStock(ingredient: Ingredient): boolean {
  return ingredient.balance > 0 && ingredient.balance <= DEFAULT_LOW_STOCK_THRESHOLD;
}

function getTypeBadge(type: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (type === 'restock') {
    return (
      <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
        <PackagePlus className="size-3" />
        {t('stock.type.added')}
      </Badge>
    );
  }
  if (type === 'usage') {
    return (
      <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
        <Utensils className="size-3" />
        {t('stock.type.used')}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
      <PackageX className="size-3" />
      {t('stock.type.wasted')}
    </Badge>
  );
}

function getStatusBadge(type: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (type === 'restock') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
        <PackagePlus className="size-3" />
        {t('stock.type.added')}
      </span>
    );
  }
  if (type === 'usage') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
        <Utensils className="size-3" />
        {t('stock.type.used')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">
      <PackageX className="size-3" />
      {t('stock.type.wasted')}
    </span>
  );
}

function formatDate(dateStr: string, locale: Locale) {
  return new Date(dateStr).toLocaleString(uiLocale(locale));
}

export default function StockView({ 
  symbol = 'Rs',
  initialFilter,
}: { 
  symbol?: string;
  initialFilter?: 'low' | 'out';
}) {
  const { t, locale } = useLocale();
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
  const initialHistory = buildDateRange('30d');
  const [filterFrom, setFilterFrom] = useState(initialHistory.start.slice(0, 10));
  const [filterTo, setFilterTo] = useState(initialHistory.end.slice(0, 10));
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
    price: number;
    totalPrice: number;
  }[]>([]);
  const [reportEntries, setReportEntries] = useState<StockEntry[]>([]);
  const [purchaseView, setPurchaseView] = useState<'day' | 'month'>('day');
  const [purchaseFrom, setPurchaseFrom] = useState(initialRange.start);
  const [purchaseTo, setPurchaseTo] = useState(initialRange.end);
  const [purchaseDateRangeOpen, setPurchaseDateRangeOpen] = useState(false);
  const [purchaseEntries, setPurchaseEntries] = useState<StockEntry[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
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
      setError(err instanceof Error ? err.message : t('stock.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setReportEntries(entries);

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
          price: ingredient?.costPerUnit ?? 0,
          totalPrice: Math.round((ingredient?.costPerUnit ?? 0) * data.restocks * 100) / 100,
        });
      }

      setReportData(reportRows);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : t('stock.reportLoadFailed'));
    } finally {
      setReportLoading(false);
    }
  }, [reportFrom, reportTo, list, t]);

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
      'Price',
      'Total Price',
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
      r.price,
      r.totalPrice,
    ]);
    downloadCsv(`stock-report-${reportFrom}-to-${reportTo}.csv`, header, rows);
  }, [reportData, reportFrom, reportTo]);

  // Purchases grouped by day / month for the chosen purchase range
  const loadPurchases = useCallback(async () => {
    setPurchaseLoading(true);
    try {
      const res = await api.getStockEntries({
        startDate: localInputToIso(purchaseFrom),
        endDate: localInputToIso(purchaseTo, true),
      });
      setPurchaseEntries(res.entries);
    } catch {
      setPurchaseEntries([]);
    } finally {
      setPurchaseLoading(false);
    }
  }, [purchaseFrom, purchaseTo]);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  const purchaseGroups = useMemo(() => {
    const costMap = new Map<number, number>();
    const unitMap = new Map<number, string>();
    list.forEach((i) => {
      costMap.set(i.id, i.costPerUnit || 0);
      unitMap.set(i.id, i.unit);
    });
    const periods = new Map<
      string,
      { label: string; items: Map<number, { name: string; unit: string; qty: number; price: number; total: number }> }
    >();
    for (const e of purchaseEntries) {
      if (e.type !== 'restock') continue;
      const d = new Date(e.createdAt);
      const keyDate =
        purchaseView === 'day'
          ? d.toISOString().slice(0, 10)
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label =
        purchaseView === 'day'
          ? d.toLocaleDateString(uiLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' })
          : d.toLocaleDateString(uiLocale(locale), { month: 'long', year: 'numeric' });
      const price = costMap.get(e.ingredientId) ?? 0;
      const qty = Number(e.quantity);
      const period = periods.get(keyDate) || { label, items: new Map() };
      const current = period.items.get(e.ingredientId) || {
        name: e.ingredientName || `Item ${e.ingredientId}`,
        unit: e.unit || unitMap.get(e.ingredientId) || 'pcs',
        qty: 0,
        price,
        total: 0,
      };
      current.qty += qty;
      current.total += qty * price;
      period.items.set(e.ingredientId, current);
      periods.set(keyDate, period);
    }

    const rows: { label: string; name: string; unit: string; qty: number; price: number; total: number }[] = [];
    let totalQty = 0;
    let totalCost = 0;
    Array.from(periods.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .forEach(([, period]) => {
        Array.from(period.items.values()).forEach((item) => {
          const q = Math.round(item.qty * 100) / 100;
          const t = Math.round(item.total * 100) / 100;
          rows.push({ label: period.label, name: item.name, unit: item.unit, qty: q, price: item.price, total: t });
          totalQty += q;
          totalCost += t;
        });
      });
    return { rows, total: { qty: Math.round(totalQty * 100) / 100, cost: Math.round(totalCost * 100) / 100 } };
  }, [purchaseEntries, purchaseView, list, locale]);

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
        t('stock.addedToast', {
          qty: Number(restockQty),
          unit: selected.unit,
          name: selected.name,
          amount: `${symbol}${paidTotal.toFixed(2)}`,
        })
      );
      setRestockQty('');
      setRestockPaid('');
      setRestockNote('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('stock.restockFailed'));
    } finally {
      setRestocking(false);
    }
  };

  const saveIngredient = async () => {
    if (!form.name.trim()) {
      setFormError(t('common.nameRequired'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const costPerUnit = Number(form.costPerUnit) || 0;
      if (form.id) {
        await api.updateIngredient(Number(form.id), { name: form.name.trim(), unit: form.unit, costPerUnit });
        toast.success(t('stock.itemUpdated'));
      } else {
        await api.createIngredient({ name: form.name.trim(), unit: form.unit as Unit, costPerUnit });
        toast.success(t('stock.itemAdded'));
      }
      setForm(emptyIngredient);
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.saveFailed'));
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
        deductType === 'wastage'
          ? t('stock.wastedToast', {
              qty: Number(deductQty),
              unit: deductTarget.unit,
              name: deductTarget.name,
              note: deductNote.trim(),
            })
          : t('stock.usageToast', {
              qty: Number(deductQty),
              unit: deductTarget.unit,
              name: deductTarget.name,
            })
      );
      setDeductTarget(null);
      await Promise.all([load(), loadEntries()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('stock.couldNotLog'));
    } finally {
      setDeducting(false);
    }
  };

  const remove = async (i: Ingredient) => {
    try {
      await api.deleteIngredient(i.id);
      toast.success(t('stock.removedToast', { name: i.name }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('stock.couldNotRemove'));
    } finally {
      setDeleteTarget(null);
    }
  };

  // ===== DataTable Column Definitions =====

  // Manage tab - Stock Items table
  const stockItemColumns = useMemo<ColumnDef<Ingredient>[]>(() => [
    {
      id: 'name',
      header: t('stock.h.name'),
      accessorKey: 'name',
      cell: ({ row }) => {
        const i = row.original;
        const outOfStock = i.balance <= 0;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{i.name}</span>
            {outOfStock && (
              <Badge variant="destructive" className="text-xs">
                {t('stock.outOfStock')}
              </Badge>
            )}
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'balance',
      header: t('stock.h.amountLeft'),
      accessorKey: 'balance',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium tabular-nums">
          {Number(row.original.balance).toFixed(2)} {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'price',
      header: t('stock.h.price'),
      accessorKey: 'costPerUnit',
      cell: ({ row }) => {
        const i = row.original;
        return i.costPerUnit > 0 ? (
          <span className="font-mono text-sm tabular-nums">
            {symbol}{Number(i.costPerUnit).toFixed(2)} / {i.unit}
          </span>
        ) : (
          <Badge variant="secondary" className="text-xs font-normal">
            {t('stock.notSet')}
          </Badge>
        );
      },
      meta: { align: 'right' },
    },
    {
      id: 'lastChange',
      header: t('stock.h.lastChange'),
      accessorKey: 'lastEntry',
      cell: ({ row }) => {
        const i = row.original;
        if (!i.lastEntry) {
          return (
            <Badge variant="secondary" className="text-xs">
              {t('stock.notStockedYet')}
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="gap-1 max-w-[220px] truncate">
            {getTypeBadge(i.lastEntry.type, t).props.children}
            <span className="text-muted-foreground">{t('stock.by', { user: i.lastEntry.userName })}</span>
          </Badge>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'actions',
      header: t('stock.h.actions'),
      accessorKey: 'id',
      enableSorting: false,
      enableFiltering: false,
      cell: ({ row }) => {
        const i = row.original;
        const outOfStock = i.balance <= 0;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('stock.actionsFor', { name: i.name })}
              >
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => openDeduct(i, 'usage')}>
                <Utensils className="size-4" /> {t('stock.markUsed')}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => openDeduct(i, 'wastage')}>
                <PackageX className="size-4" /> {t('stock.markWasted')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => editIngredient(i)}>
                <Pencil className="size-4" /> {t('stock.editItem')}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(i)}>
                <Trash2 className="size-4" /> {t('stock.deleteItem')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      meta: { align: 'right', className: 'w-12' },
    },
  ], [symbol, t]);

  // Stock History table
  const historyColumns = useMemo<ColumnDef<StockEntry>[]>(() => [
    {
      id: 'date',
      header: t('stock.h.date'),
      accessorKey: 'createdAt',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.original.createdAt, locale)}
        </span>
      ),
      meta: { align: 'left' },
    },
    {
      id: 'ingredient',
      header: t('stock.h.ingredient'),
      accessorKey: 'ingredientName',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.ingredientName}</span>
      ),
      meta: { align: 'left' },
    },
    {
      id: 'type',
      header: t('stock.h.type'),
      accessorKey: 'type',
      cell: ({ row }) => getStatusBadge(row.original.type, t),
      meta: { align: 'left' },
    },
    {
      id: 'quantity',
      header: t('stock.h.quantity'),
      accessorKey: 'quantity',
      cell: ({ row }) => {
        const e = row.original;
        return (
          <span className="font-mono tabular-nums">
            {e.type === 'restock' ? '+' : '−'}
            {Number(e.quantity)} {e.unit}
          </span>
        );
      },
      meta: { align: 'right' },
    },
    {
      id: 'by',
      header: t('stock.h.by'),
      accessorKey: 'userName',
      cell: ({ row }) => row.original.userName,
      meta: { align: 'left' },
    },
    {
      id: 'note',
      header: t('stock.h.noteReason'),
      accessorKey: 'note',
      cell: ({ row }) => (
        <span className="max-w-[220px] truncate text-muted-foreground">
          {row.original.note || '—'}
        </span>
      ),
      meta: { align: 'left' },
    },
  ], [t, locale]);

  // Stock Report table
  const reportColumns = useMemo<ColumnDef<typeof reportData[0]>[]>(() => [
    {
      id: 'productName',
      header: t('stock.r.product'),
      accessorKey: 'productName',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.productName}</span>
      ),
      meta: { align: 'left' },
    },
    {
      id: 'restocks',
      header: t('stock.r.received'),
      accessorKey: 'restocks',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {row.original.restocks} {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'sales',
      header: t('stock.r.sold'),
      accessorKey: 'sales',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {row.original.sales} {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'wastage',
      header: t('stock.r.wasted'),
      accessorKey: 'wastage',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {row.original.wastage} {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'adjustments',
      header: t('stock.r.adjusted'),
      accessorKey: 'adjustments',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {row.original.adjustments} {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'theoretical',
      header: t('stock.r.shouldBeLeft'),
      accessorKey: 'theoretical',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {row.original.theoretical} {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'actual',
      header: t('stock.r.actuallyLeft'),
      accessorKey: 'actual',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {row.original.actual} {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'variance',
      header: t('stock.r.difference'),
      accessorKey: 'variance',
      cell: ({ row }) => (
        <span className={row.original.variance < 0 ? 'text-destructive' : row.original.variance > 0 ? 'text-emerald-600' : ''}>
          {row.original.variance >= 0 ? '+' : ''}{row.original.variance} {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'sellThrough',
      header: t('stock.r.pctSold'),
      accessorKey: 'sellThrough',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {row.original.sellThrough}%
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'price',
      header: t('stock.r.price'),
      accessorKey: 'price',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {symbol}{Number(row.original.price).toFixed(2)} / {row.original.unit}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'totalPrice',
      header: t('stock.r.totalPrice'),
      accessorKey: 'totalPrice',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums font-semibold">
          {symbol}{Number(row.original.totalPrice).toFixed(2)}
        </span>
      ),
      meta: { align: 'right' },
    },
  ], [symbol, t]);

  // Filtered stock items for manage tab
  const filteredStockItems = useMemo(() => {
    return list.filter((i) => {
      if (stockFilter === 'low') return isLowStock(i) && i.balance > 0;
      if (stockFilter === 'out') return i.balance <= 0;
      return true;
    });
  }, [list, stockFilter]);

  // History additional filters
  const historyAdditionalFilters = useMemo(() => (
    <>
      <Select value={filterIngredient} onValueChange={(v) => setFilterIngredient(v ?? 'all')}>
        <SelectTrigger aria-label={t('stock.pickItem')} className="h-9 w-[160px] shrink-0">
          <SelectValue placeholder={t('stock.allItems')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('stock.allItems')}</SelectItem>
          {list.map((i) => (
            <SelectItem key={i.id} value={String(i.id)}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filterType} onValueChange={(v) => setFilterType(v ?? 'all')}>
        <SelectTrigger aria-label={t('stock.whatToShow')} className="h-9 w-[140px] shrink-0">
          <SelectValue placeholder={t('stock.everything')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('stock.everything')}</SelectItem>
          <SelectItem value="restock">{t('stock.type.added')}</SelectItem>
          <SelectItem value="usage">{t('stock.type.used')}</SelectItem>
          <SelectItem value="wastage">{t('stock.type.wasted')}</SelectItem>
        </SelectContent>
      </Select>
      <DateRangePicker
        value={
          filterFrom && filterTo
            ? { preset: 'custom', range: { preset: 'custom', start: new Date(filterFrom).toISOString(), end: new Date(filterTo).toISOString() } }
            : { preset: '30d', range: buildDateRange('30d') }
        }
        onChange={(v) => {
          if (v.preset === 'custom') {
            setFilterFrom(v.range.start.slice(0, 10));
            setFilterTo(v.range.end.slice(0, 10));
          } else {
            const r = buildDateRange(v.preset);
            setFilterFrom(r.start.slice(0, 10));
            setFilterTo(r.end.slice(0, 10));
          }
        }}
      />
    </>
  ), [filterIngredient, filterType, filterFrom, filterTo, list, t]);

  // Report additional filters
  const reportAdditionalFilters = useMemo(() => (
    <>
      <DateRangePicker
        value={
          reportFrom && reportTo
            ? { preset: 'custom', range: { preset: 'custom', start: new Date(reportFrom).toISOString(), end: new Date(reportTo).toISOString() } }
            : { preset: '30d', range: buildDateRange('30d') }
        }
        onChange={(v) => {
          if (v.preset === 'custom') {
            setReportFrom(v.range.start.slice(0, 10));
            setReportTo(v.range.end.slice(0, 10));
          } else {
            const r = buildDateRange(v.preset);
            setReportFrom(r.start.slice(0, 10));
            setReportTo(r.end.slice(0, 10));
          }
        }}
      />
      <Button onClick={loadReport} disabled={reportLoading}>
        {reportLoading ? t('stock.loading') : t('common.apply')}
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
          <TooltipContent>{t('stock.exportCsv')}</TooltipContent>
        </Tooltip>
      )}
    </>
  ), [reportFrom, reportTo, reportData.length, reportLoading, t]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('stock.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('stock.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          {t('shell.updatedAgo', { seconds: Math.round((Date.now() - updatedAt) / 1000) })}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon-sm" className="ml-1" aria-label={t('dash.refresh')} onClick={() => { void load(); void loadEntries(); setUpdatedAt(Date.now()); }}>
                  <RefreshCw className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>{t('dash.refresh')}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="size-4" />
          {error}
          <Button variant="ghost" size="sm" onClick={() => { setError(null); void load(); }}>
            {t('common.retry')}
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
              <p className="text-sm text-semibold text-muted-foreground">{t('stock.itemsInStock')}</p>
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
              <p className="text-sm text-semibold text-muted-foreground">{t('stock.nothingLeft')}</p>
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
              <span className="text-sm text-semibold text-muted-foreground">{t('stock.valueOnHand')}</span>
            </div>
            <p className="text-3xl font-bold leading-none tabular-nums text-center">{symbol}{(summary?.stockWorth ?? list.reduce((total, item) => total + Number(item.value || 0), 0)).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="restock">
        <TabsList variant="line" className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="restock" className="flex-none px-1 pb-2.5 pt-2 data-active:after:bg-primary">
            {t('stock.addStock')}
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex-none px-1 pb-2.5 pt-2 data-active:after:bg-primary">
            {t('stock.stockList')}
          </TabsTrigger>
          <TabsTrigger value="report" className="flex-none px-1 pb-2.5 pt-2 data-active:after:bg-primary">
            {t('stock.report')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="restock" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('stock.addReceived')}</CardTitle>
              <CardDescription>
                {t('stock.addReceivedDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="restock-ingredient">{t('stock.item')}</Label>
                  <Select value={restockId} onValueChange={(v) => setRestockId(v ?? '')}>
                    <SelectTrigger id="restock-ingredient" className="w-full">
                      <SelectValue placeholder={t('stock.pickItem')} />
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
                  <Label htmlFor="restock-qty">{t('common.quantity')}{selected ? ` (${selected.unit})` : ''}</Label>
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
                  <Label htmlFor="restock-paid">{t('stock.totalPrice', { symbol })}</Label>
                  <Input
                    id="restock-paid"
                    type="number"
                    step="0.01"
                    min={0}
                    value={restockPaid}
                    onChange={(e) => setRestockPaid(e.target.value)}
                    placeholder={t('stock.totalPriceLabel')}
                  />
                  {restockQtyNum > 0 && paidTotal > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('stock.perUnit', { amount: `${symbol}${(paidTotal / restockQtyNum).toFixed(2)}` })}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="restock-note">{t('stock.noteOptional')}</Label>
                <Input
                  id="restock-note"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  placeholder={t('stock.noteExample')}
                />
              </div>
              <Button
                type="button"
                onClick={restock}
                disabled={restocking || !selected || !Number(restockQty) || !Number(restockPaid)}
                className="w-fit"
              >
                <PackagePlus className="size-4" />
                {restocking ? t('stock.saving') : t('stock.addStock')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="text-base">{t('stock.whatWeHave')}</CardTitle>
                <CardDescription>{t('stock.whatWeHaveDesc')}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as 'all' | 'low' | 'out')}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder={t('stock.allStock')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('stock.allStock')}</SelectItem>
                    <SelectItem value="low">{t('common.lowStock')}</SelectItem>
                    <SelectItem value="out">{t('stock.outOfStock')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus className="size-4" />
                  {t('stock.addNewItem')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable<Ingredient>
                columns={stockItemColumns}
                data={filteredStockItems}
                keyField="id"
                searchPlaceholder={t('stock.searchItems')}
                pageSize={15}
                showSearch={true}
                showPagination={true}
                showColumnVisibility={true}
                showRowSelection={false}
                bordered={true}
                loading={loading}
                emptyMessage={t('stock.emptyItems')}
                additionalFilters={
                  <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as 'all' | 'low' | 'out')}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder={t('stock.allStock')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('stock.allStock')}</SelectItem>
                      <SelectItem value="low">{t('common.lowStock')}</SelectItem>
                      <SelectItem value="out">{t('stock.outOfStock')}</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('stock.history')}</CardTitle>
              <CardDescription>{t('stock.historyDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DataTable<StockEntry>
                columns={historyColumns}
                data={entries}
                keyField="id"
                searchPlaceholder={t('stock.searchHistory')}
                pageSize={15}
                showSearch={true}
                showPagination={true}
                showColumnVisibility={true}
                showRowSelection={false}
                bordered={true}
                loading={false}
                emptyMessage={t('stock.historyEmpty')}
                additionalFilters={historyAdditionalFilters}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <PackagePlus className="size-4 text-primary" />
                  {t('stock.stockPurchased')}
                </CardTitle>
                <CardDescription>
                  {t('stock.purchasedDesc', { by: purchaseView === 'day' ? t('stock.byDay') : t('stock.byMonth') })}
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DateRangePicker
                  value={
                    purchaseFrom && purchaseTo
                      ? { preset: 'custom', range: { preset: 'custom', start: new Date(purchaseFrom).toISOString(), end: new Date(purchaseTo).toISOString() } }
                      : { preset: '30d', range: buildDateRange('30d') }
                  }
                  onChange={(v) => {
                    if (v.preset === 'custom') {
                      setPurchaseFrom(v.range.start.slice(0, 10));
                      setPurchaseTo(v.range.end.slice(0, 10));
                    } else {
                      const r = buildDateRange(v.preset);
                      setPurchaseFrom(r.start.slice(0, 10));
                      setPurchaseTo(r.end.slice(0, 10));
                    }
                  }}
                />
                <div className="flex rounded-md border bg-muted/50 p-0.5">
                <Button
                  variant={purchaseView === 'day' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8"
                  onClick={() => setPurchaseView('day')}
                >
                  {t('stock.byDay')}
                </Button>
                <Button
                  variant={purchaseView === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8"
                  onClick={() => setPurchaseView('month')}
                >
                  {t('stock.byMonth')}
                </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {purchaseGroups.rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('stock.noRestocks')}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold border border-border">
                          {purchaseView === 'day' ? t('stock.date') : t('stock.month')}
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold border border-border">{t('stock.itemBought')}</th>
                        <th className="px-4 py-2.5 text-right font-semibold border border-border">{t('common.quantity')}</th>
                        <th className="px-4 py-2.5 text-right font-semibold border border-border">{t('stock.pricePerUnit')}</th>
                        <th className="px-4 py-2.5 text-right font-semibold border border-border">{t('stock.totalPriceLabel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseGroups.rows.map((g, i) => (
                        <tr key={`${g.label}-${g.name}-${i}`} className="hover:bg-muted/50">
                          <td className="px-4 py-2.5 font-medium border border-border whitespace-nowrap">{g.label}</td>
                          <td className="px-4 py-2.5 border border-border">{g.name}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums border border-border">
                            {g.qty} {g.unit}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums border border-border">
                            {symbol}{g.price.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums border border-border">
                            {symbol}{g.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/60 font-semibold">
                        <td className="px-4 py-2.5 border border-border" colSpan={3}>{t('common.total')}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums border border-border">
                          {Math.round(purchaseGroups.total.qty * 100) / 100}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums border border-border">
                          {symbol}{purchaseGroups.total.cost.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                {t('stock.stockReport')}
              </CardTitle>
              <CardDescription>
                {t('stock.reportDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportError && (
                <div className="flex items-center gap-2 rounded-md border bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {reportError}
                </div>
              )}
              <DataTable<typeof reportData[0]>
                columns={reportColumns}
                data={reportData}
                keyField={(row) => row.productName}
                searchPlaceholder={t('stock.searchProducts')}
                pageSize={15}
                showSearch={true}
                showPagination={true}
                showColumnVisibility={true}
                showRowSelection={false}
                bordered={true}
                loading={reportLoading}
                emptyMessage={t('stock.noMovements')}
                additionalFilters={reportAdditionalFilters}
              />
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
              {deductType === 'usage'
                ? t('stock.markUsedTitle', { name: deductTarget?.name ?? '' })
                : t('stock.markWastedTitle', { name: deductTarget?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('stock.youHaveRightNow')}{' '}
              <span className="font-medium text-foreground">
                {deductTarget ? `${Number(deductTarget.balance).toFixed(2)} ${deductTarget.unit}` : ''}
              </span>
              {deductType === 'wastage' && ` ${t('stock.writeWhyWasted')}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="deduct-qty">{t('stock.howMuch', { unit: deductTarget?.unit ?? '' })}</Label>
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
                {deductType === 'wastage' ? t('stock.reasonRequired') : t('stock.noteOptional')}
              </Label>
              <Input
                id="deduct-note"
                value={deductNote}
                onChange={(e) => setDeductNote(e.target.value)}
                placeholder={
                  deductType === 'wastage' ? t('stock.wasteExample') : t('stock.usageExample')
                }
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitDeduction}
              disabled={
                deducting ||
                !Number(deductQty) ||
                (deductType === 'wastage' && !deductNote.trim())
              }
            >
              {deducting ? t('stock.saving') : t('common.save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? t('stock.editItemTitle') : t('stock.addItemTitle')}</DialogTitle>
            <DialogDescription>
              {t('stock.itemDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ingredient-name">{t('stock.itemName')}</Label>
              <Input
                id="ingredient-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('stock.itemNameExample')}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ingredient-unit">{t('stock.countedIn')}</Label>
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
              <Label htmlFor="ingredient-cost">{t('stock.priceForOne', { symbol })}</Label>
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
                {t('stock.priceHelper')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={saveIngredient}
              disabled={saving || !form.name.trim() || !(Number(form.costPerUnit) > 0)}
            >
              {saving ? t('stock.saving') : form.id ? t('stock.saveChanges') : t('stock.addItem')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stock.removeTitle', { name: deleteTarget?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('stock.removeDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && remove(deleteTarget)}
            >
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}