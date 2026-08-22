import React, { useEffect, useMemo, useState } from 'react';
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
import { buildInvoicePdf } from '../lib/reportPdf';
import { buildCsv, buildWorkbook, downloadFile, downloadCsv, salesRows } from '../lib/export';
import { getPosBridge, isElectronBridge } from '../bridge';
import Invoice from '../components/Invoice';
import { toast } from 'sonner';
import { DataTable, ColumnDef } from '../components/DataTable';

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

function formatTxDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { day: dateStr, time: '' };
  const day = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
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

function getStatusBadge(status: number) {
  if (status === 1) {
    return (
      <Badge className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 font-semibold px-2 py-0.5 text-xs rounded-sm">
        Paid
      </Badge>
    );
  }
  if (status === 2) {
    return (
      <Badge variant="destructive" className="font-semibold px-2 py-0.5 text-xs rounded-sm">
        Voided
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-semibold px-2 py-0.5 text-xs rounded-sm">
      Open
    </Badge>
  );
}

export default function SalesView({ symbol, settings, onClose, initialStatus = 'all', initialUserId = 0, initialVoidFilter = false }: Props) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [userId, setUserId] = useState<string>(String(initialUserId));
  const [status, setStatus] = useState<string>(initialVoidFilter ? '2' : initialStatus);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
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
      toast.success('Sale voided successfully');
      setVoidTx(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Void failed');
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
      toast.success('Transaction deleted');
      setDeleteTx(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
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

    const topMethod = sortedMethods[0] || { name: 'Cash', pct: 0 };
    const otherMethods = sortedMethods.slice(1);
    const splitText = otherMethods.length > 0
      ? otherMethods.map((m) => `${m.name} ${m.pct}%`).join(' · ')
      : 'Card 0% · UPI 0%';

    return {
      total,
      count,
      average,
      topMethodLabel: topMethod.name,
      topMethodPct: topMethod.pct,
      splitText,
    };
  }, [filteredRows]);

  // Column definitions for DataTable
  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      id: 'invoice',
      header: 'INVOICE',
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
      header: 'DATE',
      accessorKey: 'date',
      cell: ({ row }) => {
        const { day, time } = formatTxDate(row.original.date);
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
      header: 'CUSTOMER',
      accessorKey: 'customer_name',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="font-semibold text-foreground text-sm leading-tight">
              {r.customer_name || 'Walk-in Customer'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">
              {r.fulfillment || 'Walk-in'}
            </div>
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'cashier',
      header: 'STAFF',
      accessorKey: 'user',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="text-sm font-medium text-foreground leading-tight">
              {r.user || 'Administrator'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Till {r.till || 1}
            </div>
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'order',
      header: 'ORDER',
      accessorKey: 'fulfillment',
      cell: ({ row }) => (
        <span className="text-sm capitalize text-muted-foreground">
          {row.original.fulfillment || 'Walk-in'}
        </span>
      ),
      meta: { align: 'left' },
    },
    {
      id: 'items',
      header: 'ITEMS',
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
      header: 'TOTAL',
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
      header: 'PAYMENT',
      accessorKey: 'payment_type',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="text-sm font-medium text-foreground leading-tight">
              {getPaymentInfo(r)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {symbol}{Number(r.paid || 0).toFixed(2)} paid
            </div>
          </div>
        );
      },
      meta: { align: 'left' },
    },
    {
      id: 'status',
      header: 'STATUS',
      accessorKey: 'status',
      cell: ({ row }) => getStatusBadge(row.original.status),
      meta: { align: 'left' },
    },
    {
      id: 'actions',
      header: 'ACTIONS',
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
                  aria-label="View invoice"
                  onClick={() => setInvoice(r)}
                >
                  <Eye className="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View invoice</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-md"
                  aria-label="Print invoice"
                  onClick={() =>
                    printReportPdf(buildInvoicePdf({ settings, tx: r }))
                  }
                >
                  <Printer className="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print invoice</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-md"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setInvoice(r)}>
                  <Eye className="size-4 mr-2" /> View details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    printReportPdf(buildInvoicePdf({ settings, tx: r }))
                  }
                >
                  <Printer className="size-4 mr-2" /> Print receipt
                </DropdownMenuItem>
                {r.status === 1 && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setVoidTx(r)}
                  >
                    <Ban className="size-4 mr-2" /> Void sale
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteTx(r)}
                >
                  <Trash2 className="size-4 mr-2" /> Delete transaction
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
  ], [symbol, settings]);

  // Print handler (defined before toolbar to avoid temporal dead zone)
  const handlePrintReport = () => {
    printReportPdf();
  };

  // Toolbar for export/print
  const toolbar = useMemo(() => (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Upload className="size-4" />
            <span>Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => handleExport('xlsx')}>
            <FileSpreadsheet className="size-4 mr-2" /> Export to Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('csv')}>
            <FileText className="size-4 mr-2" /> Export to CSV (.csv)
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
        <span>Print report</span>
      </Button>
    </div>
  ), []);

  // Summary cards
  const summaryCards = useMemo(() => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="shadow-xs">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Total sales</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {symbol}{summary.total.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Across filtered results</p>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Transactions</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {summary.count}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Completed orders</p>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Average order</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {symbol}{summary.average.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Per transaction</p>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Payment split</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {summary.topMethodLabel} {summary.topMethodPct}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.splitText}</p>
        </CardContent>
      </Card>
    </div>
  ), [summary, symbol]);

  // Export handlers
  const handleExport = async (format: 'xlsx' | 'csv') => {
    const targetRows = filteredRows;

    if (targetRows.length === 0) {
      toast.error('No transactions to export');
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
        toast.success(`Exported ${targetRows.length} transactions to Excel`);
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
        toast.success(`Exported ${targetRows.length} transactions to CSV`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // Filter bar additional filters
  const additionalFilters = useMemo(() => (
    <>
      {/* Cashier Selector */}
      <Select
        value={userId}
        onValueChange={(val) => {
          setUserId(val || '0');
        }}
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="All cashiers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">All cashiers</SelectItem>
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
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="1">Paid</SelectItem>
          <SelectItem value="0">Unpaid / Hold</SelectItem>
          <SelectItem value="2">Voided</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setUserId('0');
          setStatus('all');
          setDatePreset('all');
          setCustomStart('');
          setCustomEnd('');
          setDateRange(null);
        }}
        className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
        <span>Clear</span>
      </Button>
    </>
  ), [userId, status, datePreset, users]);

  // Date range trigger
  const dateTriggerLabel = useMemo(() => {
    if (datePreset === 'today') {
      return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (datePreset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return y.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (datePreset === '7d') return 'Last 7 days';
    if (datePreset === '30d') return 'Last 30 days';
    if (datePreset === 'month') return 'This month';
    if (datePreset === 'custom' && customStart) {
      return `${customStart} – ${customEnd || 'Now'}`;
    }
    return 'All time';
  }, [datePreset, customStart, customEnd]);

  const handleDateRangeChange = (range: { start: string; end: string } | null) => {
    setDateRange(range);
    if (range) {
      setCustomStart(range.start);
      setCustomEnd(range.end);
      setDatePreset('custom');
    } else {
      setDatePreset('all');
      setCustomStart('');
      setCustomEnd('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
            SALES HISTORY
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, print, and manage every completed order.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {toolbar}
        </div>
      </div>

      {/* Summary Cards */}
      {summaryCards}

      {/* DataTable */}
      <DataTable<Transaction>
        columns={columns}
        data={filteredRows}
        keyField="id"
        searchPlaceholder="Search invoice, customer..."
        pageSize={12}
        showSearch={true}
        showPagination={true}
        showColumnVisibility={true}
        showRowSelection={true}
        selectedIds={[]}
        loading={loading}
        emptyMessage="No sales found for these dates."
        toolbar={toolbar}
        summary={summaryCards}
        dateRangeFilter={dateRange}
        onDateRangeChange={handleDateRangeChange}
        dateRangePlaceholder="Select date range"
        additionalFilters={additionalFilters}
      />

      {/* Invoice Modal */}
      <Dialog open={!!invoice} onOpenChange={(open) => !open && setInvoice(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {invoice && <Invoice tx={invoice} settings={settings} symbol={symbol} />}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInvoice(null)}>
              Close
            </Button>
            <Button
              variant="default"
              onClick={() =>
                invoice && printReportPdf(buildInvoicePdf({ settings, tx: invoice }))
              }
            >
              <Printer className="size-4 mr-1.5" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Confirmation Dialog */}
      <AlertDialog open={!!voidTx} onOpenChange={(open) => !open && setVoidTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will refund the sale, restore product inventory, and mark transaction #{voidTx?.id} as voided. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={confirmVoid}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Void Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTx} onOpenChange={(open) => !open && setDeleteTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes transaction #{deleteTx?.id} from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}