import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api, Settings, Transaction, User } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';
import { uiLocale, Locale } from '../i18n/translations';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { Skeleton } from '../components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { printReportPdf } from '../lib/printing';
import { buildInvoicePdf, buildSalesReportPdf } from '../lib/reportPdf';
import { buildCsv, buildWorkbook, downloadFile, downloadCsv, salesRows } from '../lib/export';
import { getPosBridge, isElectronBridge } from '../bridge';
import Invoice from '../components/Invoice';
import { toast } from 'sonner';
import { DataTable, ColumnDef } from '../components/DataTable';
import { DateRangePicker, type PickerValue } from '../components/DateRangePicker';
import { buildDateRange } from '../lib/dateRange';

type Props = {
  symbol: string;
  settings: Settings | null;
  onClose?: () => void;
  initialStatus?: string;
  initialUserId?: number;
  initialVoidFilter?: boolean;
};

type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all' | 'custom';
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

function formatTxDate(dateStr: string, locale: Locale) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { day: dateStr, time: '' };
  const day = d.toLocaleDateString(uiLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(uiLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return { day, time };
}

function getPaymentInfo(row: Transaction) {
  if (row.payment_breakdown && row.payment_breakdown.length > 1) {
    return 'Split';
  }
  if (row.payment_breakdown && row.payment_breakdown.length === 1) {
    const m = row.payment_breakdown[0].method || 'cash';
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  if (row.payment_type === 2) return 'Card';
  if (row.payment_type === 3) return 'UPI';
  return 'Cash';
}

function getItemCount(row: Transaction) {
  if (!row.items || !Array.isArray(row.items)) return 0;
  return row.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getStatusBadge(status: number, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (status === 1) {
    return (
      <Badge className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 font-semibold px-2 py-0.5 text-xs rounded-sm">
        {t('sales.status.paid')}
      </Badge>
    );
  }
  if (status === 2) {
    return (
      <Badge variant="destructive" className="font-semibold px-2 py-0.5 text-xs rounded-sm">
        {t('sales.status.voided')}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-semibold px-2 py-0.5 text-xs rounded-sm">
      {t('sales.status.open')}
    </Badge>
  );
}

export default function SalesView({ symbol, settings, onClose, initialStatus = 'all', initialUserId = 0, initialVoidFilter = false }: Props) {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [userId, setUserId] = useState<string>(String(initialUserId));
  const [status, setStatus] = useState<string>(initialVoidFilter ? '2' : initialStatus);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [dateValue, setDateValue] = useState<PickerValue>({ preset: 'today', range: buildDateRange('today') });

  // Modals
  const [invoice, setInvoice] = useState<Transaction | null>(null);
  const [voidTx, setVoidTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setError(null);
    setLoading(true);
    try {
      const [allTx, allUsers] = await Promise.all([
        api.getAllTransactions().catch(async () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), 0, 1).toISOString();
          const end = new Date(now.getFullYear() + 1, 0, 1).toISOString();
          return api.getByDate({ start, end, user: 0, till: 0, status: 1 });
        }),
        api.getUsers().catch(() => [] as User[]),
      ]);
      setRows(allTx);
      setUsers(allUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sales.failedLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Handle Void
  const confirmVoid = async () => {
    if (!voidTx) return;
    setActionLoading(true);
    try {
      await api.request(`/api/transactions/${voidTx.id}/void`, { method: 'POST' });
      toast.success(t('sales.voidedSuccess'));
      setVoidTx(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('sales.voidFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete
  const confirmDelete = async () => {
    if (!deleteTx) return;
    setActionLoading(true);
    try {
      await api.deleteTransaction(deleteTx.id);
      toast.success(t('sales.deletedSuccess'));
      setDeleteTx(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.deleteFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  // Filter rows - now done by TanStack Table, but we need to apply server-side filters
  // For now, we'll do client-side filtering via the table's global filter and column filters
  // The DataTable handles sorting, pagination, global search

  const filteredRows = useMemo(() => {
    let list = [...rows];

    // Cashier filter
    if (userId !== '0') {
      list = list.filter((r) => String(r.user_id) === userId || r.user === userId);
    }

    // Status filter
    if (status !== 'all') {
      const sNum = parseInt(status, 10);
      list = list.filter((r) => r.status === sNum);
    }

    // Date filter
    const now = new Date();
    if (datePreset === 'today') {
      const todayStr = now.toDateString();
      list = list.filter((r) => new Date(r.date).toDateString() === todayStr);
    } else if (datePreset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = yesterday.toDateString();
      list = list.filter((r) => new Date(r.date).toDateString() === yestStr);
    } else if (datePreset === '7d') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 7);
      list = list.filter((r) => new Date(r.date) >= cutoff);
    } else if (datePreset === '30d') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      list = list.filter((r) => new Date(r.date) >= cutoff);
    } else if (datePreset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter((r) => new Date(r.date) >= startOfMonth);
    } else if (datePreset === '90d') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 90);
      list = list.filter((r) => new Date(r.date) >= cutoff);
    } else if (datePreset === 'custom' && customStart) {
      const start = new Date(customStart);
      const end = customEnd ? new Date(customEnd) : new Date();
      end.setHours(23, 59, 59, 999);
      list = list.filter((r) => {
        const d = new Date(r.date);
        return d >= start && d <= end;
      });
    }

    return list;
  }, [rows, userId, status, datePreset, customStart, customEnd]);

  // Metrics summary
  const summary = useMemo(() => {
    const paidTxs = filteredRows.filter((r) => r.status === 1);
    const total = paidTxs.reduce((sum, r) => sum + Number(r.total || 0), 0);
    const count = filteredRows.length;
    const average = paidTxs.length > 0 ? total / paidTxs.length : 0;

    const methodAmounts: Record<string, number> = {};
    for (const r of paidTxs) {
      if (r.payment_breakdown && r.payment_breakdown.length > 0) {
        for (const line of r.payment_breakdown) {
          const m = (line.method || 'cash').toLowerCase();
          methodAmounts[m] = (methodAmounts[m] || 0) + Number(line.amount || 0);
        }
      } else {
        const m = r.payment_type === 2 ? 'card' : r.payment_type === 3 ? 'upi' : 'cash';
        methodAmounts[m] = (methodAmounts[m] || 0) + Number(r.paid || r.total || 0);
      }
    }

    const totalMethodAmount = Object.values(methodAmounts).reduce((a, b) => a + b, 0) || total || 1;
    const sortedMethods = Object.entries(methodAmounts)
      .sort((a, b) => b[1] - a[1])
      .map(([method, amount]) => ({
        name: method.charAt(0).toUpperCase() + method.slice(1),
        pct: Math.round((amount / totalMethodAmount) * 100),
      }));

    const topMethod = sortedMethods[0] || { name: t('common.cash'), pct: 0 };
    const otherMethods = sortedMethods.slice(1);
    const splitText = otherMethods.length > 0
      ? otherMethods.map((m) => `${m.name} ${m.pct}%`).join(' · ')
      : t('sales.cardUpiFallback');

    return {
      total,
      count,
      average,
      topMethodLabel: topMethod.name,
      topMethodPct: topMethod.pct,
      splitText,
    };
  }, [filteredRows, t]);

  // Column definitions for DataTable
  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      id: 'invoice',
      header: t('sales.h.invoice'),
      accessorKey: 'id',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="font-semibold text-foreground text-sm leading-tight">
              {r.ref_number || `INV-${r.id}`}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono">
              #{r.id}
            </div>
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'date',
      header: t('sales.h.date'),
      accessorKey: 'date',
      cell: ({ row }) => {
        const { day, time } = formatTxDate(row.original.date, locale);
        return (
          <div>
            <div className="text-sm font-medium text-foreground leading-tight">{day}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{time}</div>
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'customer',
      header: t('sales.h.customer'),
      accessorKey: 'customer_name',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="font-semibold text-foreground text-sm leading-tight">
              {r.customer_name || t('common.walkinCustomer')}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">
              {r.fulfillment || t('common.walkin')}
            </div>
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'cashier',
      header: t('sales.h.staff'),
      accessorKey: 'user',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="text-sm font-medium text-foreground leading-tight">
              {r.user || t('sales.trimmed')}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t('sales.tillLabel', { till: r.till || 1 })}
            </div>
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'order',
      header: t('sales.h.order'),
      accessorKey: 'fulfillment',
      cell: ({ row }) => (
        <span className="text-sm capitalize text-muted-foreground">
          {row.original.fulfillment || t('common.walkin')}
        </span>
      ),
      meta: { align: 'left' },
    },
    {
      id: 'items',
      header: t('sales.h.items'),
      accessorKey: 'id',
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">
          {getItemCount(row.original)}
        </span>
      ),
      meta: { align: 'center' },
    },
    {
      id: 'total',
      header: t('common.total'),
      accessorKey: 'total',
      cell: ({ row }) => (
        <span className="text-sm font-bold text-foreground">
          {symbol}{Number(row.original.total || 0).toFixed(2)}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'payment',
      header: t('sales.h.payment'),
      accessorKey: 'payment_type',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="text-sm font-medium text-foreground leading-tight">
              {getPaymentInfo(r)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t('sales.paidSuffix', { amount: `${symbol}${Number(r.paid || 0).toFixed(2)}` })}
            </div>
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'status',
      header: t('sales.h.status'),
      accessorKey: 'status',
      cell: ({ row }) => getStatusBadge(row.original.status, t),
      meta: { align: 'left' },
    },
    {
      id: 'actions',
      header: t('sales.h.actions'),
      accessorKey: 'id',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-md"
                  aria-label={t('sales.viewInvoice')}
                  onClick={() => setInvoice(r)}
                >
                  <Eye className="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('sales.viewInvoice')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-md"
                  aria-label={t('sales.printInvoice')}
                  onClick={() =>
                    printReportPdf(buildInvoicePdf({ settings, tx: r }))
                  }
                >
                  <Printer className="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('sales.printInvoice')}</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-md"
                  aria-label={t('sales.moreActions')}
                >
                  <MoreHorizontal className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setInvoice(r)}>
                  <Eye className="size-4 mr-2" /> {t('sales.viewDetails')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    printReportPdf(buildInvoicePdf({ settings, tx: r }))
                  }
                >
                  <Printer className="size-4 mr-2" /> {t('sales.printReceipt')}
                </DropdownMenuItem>
                {r.status === 1 && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setVoidTx(r)}
                  >
                    <Ban className="size-4 mr-2" /> {t('sales.voidSale')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteTx(r)}
                >
                  <Trash2 className="size-4 mr-2" /> {t('sales.deleteTransaction')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableFiltering: false,
      meta: { align: 'right', className: 'pr-4' },
    },
  ], [symbol, settings, t, locale]);

  // Print handler (defined before toolbar to avoid temporal dead zone)
  const handlePrintReport = async () => {
    try {
      const r =
        dateValue.preset === 'custom'
          ? dateValue.range
          : buildDateRange(dateValue.preset);
      const report = await api.getReportSummary({
        start: r.start,
        end: r.end,
      });
      printReportPdf(
        buildSalesReportPdf({
          settings,
          start: r.start,
          end: r.end,
          report,
        })
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('sales.generateFailed'));
    }
  };

  // Toolbar for export/print
  const toolbar = useMemo(() => (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Upload className="size-4" />
            <span>{t('sales.export')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => handleExport('xlsx')}>
            <FileSpreadsheet className="size-4 mr-2" /> {t('sales.exportExcel')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('csv')}>
            <FileText className="size-4 mr-2" /> {t('sales.exportCsv')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2"
        onClick={handlePrintReport}
      >
        <Printer className="size-4" />
        <span>{t('sales.printReport')}</span>
      </Button>
    </div>
  ), [t]);

  // Summary cards
  const summaryCards = useMemo(() => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="shadow-xs">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">{t('sales.totalSales')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {symbol}{summary.total.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('sales.acrossFiltered')}</p>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">{t('sales.title')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {summary.count}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('sales.completedOrders')}</p>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">{t('sales.averageOrder')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {symbol}{summary.average.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('sales.perTransaction')}</p>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">{t('sales.paymentSplit')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {summary.topMethodLabel} {summary.topMethodPct}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.splitText}</p>
        </CardContent>
      </Card>
    </div>
  ), [summary, symbol, t]);

  // Export handlers
  const handleExport = async (format: 'xlsx' | 'csv') => {
    const targetRows = filteredRows;

    if (targetRows.length === 0) {
      toast.error(t('sales.noTransactions'));
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    const exportData = salesRows(targetRows);

    try {
      if (format === 'xlsx') {
        const workbook = buildWorkbook([{ name: 'Sales', rows: exportData }]);
        const data = Buffer.from(workbook).toString('base64');
        const bridge = getPosBridge();
        await bridge.saveFile({
          defaultName: `sales-export-${dateStamp}.xlsx`,
          type: 'xlsx',
          data,
        });
        toast.success(t('sales.exportedXlsx', { count: targetRows.length }));
      } else {
        const headers = Object.keys(exportData[0] || {});
        const csvRows = exportData.map((r) => headers.map((h) => r[h] ?? ''));
        const csvContent = buildCsv(headers, csvRows);
        const bridge = getPosBridge();
        if (isElectronBridge()) {
          const bytes = new TextEncoder().encode(csvContent);
          let bin = '';
          bytes.forEach((b) => (bin += String.fromCharCode(b)));
          await bridge.saveFile({
            defaultName: `sales-export-${dateStamp}.csv`,
            type: 'csv',
            data: btoa(bin),
          });
        } else {
          downloadCsv(`sales-export-${dateStamp}.csv`, headers, csvRows);
        }
        toast.success(t('sales.exportedCsv', { count: targetRows.length }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('sales.exportFailed'));
    }
  };

  // Date range selection via the shared DateRangePicker
  const handleDatePick = (v: PickerValue) => {
    setDateValue(v);
    if (v.preset === 'custom') {
      setDatePreset('custom');
      setCustomStart(v.range.start.slice(0, 10));
      setCustomEnd(v.range.end.slice(0, 10));
    } else {
      const r = buildDateRange(v.preset);
      setDatePreset(v.preset);
      setCustomStart(r.start.slice(0, 10));
      setCustomEnd(r.end.slice(0, 10));
    }
  };

  // Filter bar additional filters
  const additionalFilters = useMemo(() => (
    <>
      <DateRangePicker value={dateValue} onChange={handleDatePick} />

      {/* Cashier Selector */}
      <Select
        value={userId}
        onValueChange={(val) => {
          setUserId(val || '0');
        }}
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder={t('sales.allCashiers')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">{t('sales.allCashiers')}</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={String(u.id)}>
              {u.fullname}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Selector */}
      <Select
        value={status}
        onValueChange={(val) => {
          setStatus(val || 'all');
        }}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder={t('sales.allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('sales.allStatuses')}</SelectItem>
          <SelectItem value="1">{t('sales.status.paid')}</SelectItem>
          <SelectItem value="0">{t('sales.unpaidHold')}</SelectItem>
          <SelectItem value="2">{t('sales.status.voided')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setUserId('0');
          setStatus('all');
          setDatePreset('today');
          setCustomStart('');
          setCustomEnd('');
          setDateValue({ preset: 'today', range: buildDateRange('today') });
        }}
        className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
        <span>{t('payment.clear')}</span>
      </Button>
    </>
  ), [userId, status, datePreset, dateValue, users, t]);

  // Date range trigger
  const dateTriggerLabel = useMemo(() => {
    if (datePreset === 'today') {
      return new Date().toLocaleDateString(uiLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (datePreset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return y.toLocaleDateString(uiLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (datePreset === '7d') return t('daterange.7d');
    if (datePreset === '30d') return t('daterange.30d');
    if (datePreset === 'month') return t('daterange.month');
    if (datePreset === 'custom' && customStart) {
      return `${customStart} – ${customEnd || t('sales.now')}`;
    }
    return t('daterange.all');
  }, [datePreset, customStart, customEnd, t, locale]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
            {t('sales.header')}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {t('sales.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('sales.headerDesc')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {toolbar}
        </div>
      </div>

      {/* DataTable */}
      <DataTable<Transaction>
        columns={columns}
        data={filteredRows}
        keyField="id"
        searchPlaceholder={t('sales.searchPlaceholder')}
        pageSize={12}
        showSearch={true}
        showPagination={true}
        showColumnVisibility={true}
        showRowSelection={true}
        selectedIds={[]}
        loading={loading}
        emptyMessage={t('sales.empty')}
        // toolbar={toolbar}
        summary={summaryCards}
        additionalFilters={additionalFilters}
      />

      {/* Invoice Modal */}
      <Dialog open={!!invoice} onOpenChange={(open) => !open && setInvoice(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('sales.invoiceDetails')}</DialogTitle>
          </DialogHeader>
          {invoice && <Invoice tx={invoice} settings={settings} symbol={symbol} />}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInvoice(null)}>
              {t('common.close')}
            </Button>
            <Button
              variant="default"
              onClick={() =>
                invoice && printReportPdf(buildInvoicePdf({ settings, tx: invoice }))
              }
            >
              <Printer className="size-4 mr-1.5" /> {t('till.print')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Confirmation Dialog */}
      <AlertDialog open={!!voidTx} onOpenChange={(open) => !open && setVoidTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sales.voidTxTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sales.voidTxDesc', { id: voidTx?.id ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={confirmVoid}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {t('sales.voidSaleAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTx} onOpenChange={(open) => !open && setDeleteTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sales.deleteTxTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sales.deleteTxDesc', { id: deleteTx?.id ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
