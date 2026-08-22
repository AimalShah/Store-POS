import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Calendar as CalendarIcon,
  Check,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { printReportPdf } from '../lib/printing';
import { buildInvoicePdf } from '../lib/reportPdf';
import { buildCsv, buildWorkbook, downloadFile, downloadCsv, salesRows } from '../lib/export';
import { getPosBridge, isElectronBridge } from '../bridge';
import Invoice from '../components/Invoice';
import { toast } from 'sonner';

type Props = {
  symbol: string;
  settings: Settings | null;
  onClose?: () => void;
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

export default function SalesView({ symbol, settings }: Props) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState<string>('0');
  const [status, setStatus] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [dateOpen, setDateOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Table & UI state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Modals
  const [invoice, setInvoice] = useState<Transaction | null>(null);
  const [voidTx, setVoidTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Column Visibility
  const [columns, setColumns] = useState({
    invoice: true,
    date: true,
    customer: true,
    cashier: true,
    order: true,
    items: true,
    total: true,
    payment: true,
    status: true,
    actions: true,
  });

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
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTx.id));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter rows
  const filteredRows = useMemo(() => {
    let list = [...rows];

    // Search query
    const term = query.trim().toLowerCase();
    if (term) {
      list = list.filter((r) =>
        [
          r.ref_number,
          `#${r.id}`,
          r.customer_name,
          r.user,
          r.fulfillment,
          getPaymentInfo(r),
        ].some((val) => String(val || '').toLowerCase().includes(term))
      );
    }

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

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'highest') return Number(b.total || 0) - Number(a.total || 0);
      if (sortBy === 'lowest') return Number(a.total || 0) - Number(b.total || 0);
      return 0;
    });

    return list;
  }, [rows, query, userId, status, datePreset, customStart, customEnd, sortBy]);

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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  // Selection
  const allPageIds = paginatedRows.map((r) => r.id);
  const isAllSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allPageIds])));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Clear filters
  const clearFilters = () => {
    setQuery('');
    setUserId('0');
    setStatus('all');
    setDatePreset('all');
    setCustomStart('');
    setCustomEnd('');
    setSortBy('newest');
    setPage(1);
    setSelectedIds([]);
  };

  // Date label formatted for trigger button
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

  // Export handlers
  const handleExport = async (format: 'xlsx' | 'csv') => {
    const targetRows = selectedIds.length > 0
      ? rows.filter((r) => selectedIds.includes(r.id))
      : filteredRows;

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
          defaultName: `sales-export-${dateStamp()}.xlsx`,
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
            defaultName: `sales-export-${dateStamp()}.csv`,
            type: 'csv',
            data: btoa(bin),
          });
        } else {
          downloadCsv(`sales-export-${dateStamp()}.csv`, headers, csvRows);
        }
        toast.success(`Exported ${targetRows.length} transactions to CSV`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handlePrintReport = () => {
    printReportPdf();
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
      </div>

      {/* Summary Cards */}
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

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice, customer..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="h-9 pl-9 bg-background"
          />
        </div>

        {/* Date Selector */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 font-normal text-foreground"
            >
              <CalendarIcon className="size-4 text-muted-foreground" />
              <span>{dateTriggerLabel}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Date Range
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: '7d', label: 'Last 7 days' },
                  { key: '30d', label: 'Last 30 days' },
                  { key: 'month', label: 'This month' },
                  { key: 'all', label: 'All time' },
                ].map((item) => (
                  <Button
                    key={item.key}
                    variant={datePreset === item.key ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 justify-start text-xs"
                    onClick={() => {
                      setDatePreset(item.key as DatePreset);
                      setDateOpen(false);
                      setPage(1);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              <div className="pt-2 border-t space-y-2">
                <p className="text-xs font-medium text-foreground">Custom Range</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => {
                      setCustomStart(e.target.value);
                      setDatePreset('custom');
                      setPage(1);
                    }}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => {
                      setCustomEnd(e.target.value);
                      setDatePreset('custom');
                      setPage(1);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Cashier Selector */}
        <Select
          value={userId}
          onValueChange={(val) => {
            setUserId(val || '0');
            setPage(1);
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
            setPage(1);
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
          onClick={clearFilters}
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
          <span>Clear</span>
        </Button>

        {/* Columns Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 ml-auto"
            >
              <Columns3 className="size-4 text-muted-foreground" />
              <span>Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={columns.invoice}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, invoice: !!c }))}
            >
              Invoice
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.date}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, date: !!c }))}
            >
              Date
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.customer}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, customer: !!c }))}
            >
              Customer
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.cashier}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, cashier: !!c }))}
            >
              Cashier / Till
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.order}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, order: !!c }))}
            >
              Order
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.items}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, items: !!c }))}
            >
              Items
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.total}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, total: !!c }))}
            >
              Total
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.payment}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, payment: !!c }))}
            >
              Payment
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.status}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, status: !!c }))}
            >
              Status
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columns.actions}
              onCheckedChange={(c) => setColumns((p) => ({ ...p, actions: !!c }))}
            >
              Actions
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Meta header (Count & Sort) */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>{filteredRows.length} transactions found</span>

        <div className="flex items-center gap-2">
          <Select
            value={sortBy}
            onValueChange={(val) => setSortBy((val as SortOption) || 'newest')}
          >
            <SelectTrigger className="h-8 border-none bg-transparent shadow-none px-2 text-xs font-normal text-muted-foreground hover:text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="highest">Highest total</SelectItem>
              <SelectItem value="lowest">Lowest total</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-lg border bg-card overflow-hidden shadow-xs">
        {error && (
          <div className="border-b bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                {columns.invoice && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    INVOICE
                  </TableHead>
                )}
                {columns.date && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    DATE
                  </TableHead>
                )}
                {columns.customer && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    CUSTOMER
                  </TableHead>
                )}
                {columns.cashier && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    CASHIER / TILL
                  </TableHead>
                )}
                {columns.order && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    ORDER
                  </TableHead>
                )}
                {columns.items && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                    ITEMS
                  </TableHead>
                )}
                {columns.total && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                    TOTAL
                  </TableHead>
                )}
                {columns.payment && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    PAYMENT
                  </TableHead>
                )}
                {columns.status && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    STATUS
                  </TableHead>
                )}
                {columns.actions && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-4">
                    ACTIONS
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4">
                      <Skeleton className="size-4" />
                    </TableCell>
                    {columns.invoice && (
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-12 mt-1" />
                      </TableCell>
                    )}
                    {columns.date && (
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16 mt-1" />
                      </TableCell>
                    )}
                    {columns.customer && (
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-16 mt-1" />
                      </TableCell>
                    )}
                    {columns.cashier && (
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-12 mt-1" />
                      </TableCell>
                    )}
                    {columns.order && (
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                    )}
                    {columns.items && (
                      <TableCell>
                        <Skeleton className="h-4 w-6 mx-auto" />
                      </TableCell>
                    )}
                    {columns.total && (
                      <TableCell>
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                    )}
                    {columns.payment && (
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-16 mt-1" />
                      </TableCell>
                    )}
                    {columns.status && (
                      <TableCell>
                        <Skeleton className="h-5 w-12" />
                      </TableCell>
                    )}
                    {columns.actions && (
                      <TableCell className="pr-4">
                        <Skeleton className="h-8 w-24 ml-auto" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No transactions found in this range.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((r) => {
                  const { day, time } = formatTxDate(r.date);
                  const isChecked = selectedIds.includes(r.id);

                  return (
                    <TableRow
                      key={r.id}
                      data-state={isChecked ? 'selected' : undefined}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(r.id)}
                          aria-label={`Select transaction ${r.ref_number || r.id}`}
                        />
                      </TableCell>

                      {columns.invoice && (
                        <TableCell>
                          <div className="font-semibold text-foreground text-sm leading-tight">
                            {r.ref_number || `INV-${r.id}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                            #{r.id}
                          </div>
                        </TableCell>
                      )}

                      {columns.date && (
                        <TableCell>
                          <div className="text-sm font-medium text-foreground leading-tight">
                            {day}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {time}
                          </div>
                        </TableCell>
                      )}

                      {columns.customer && (
                        <TableCell>
                          <div className="font-semibold text-foreground text-sm leading-tight">
                            {r.customer_name || 'Walk-in Customer'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                            {r.fulfillment || 'Walk-in'}
                          </div>
                        </TableCell>
                      )}

                      {columns.cashier && (
                        <TableCell>
                          <div className="text-sm font-medium text-foreground leading-tight">
                            {r.user || 'Administrator'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Till {r.till || 1}
                          </div>
                        </TableCell>
                      )}

                      {columns.order && (
                        <TableCell className="text-sm capitalize text-muted-foreground">
                          {r.fulfillment || 'Walk-in'}
                        </TableCell>
                      )}

                      {columns.items && (
                        <TableCell className="text-center text-sm font-medium text-foreground">
                          {getItemCount(r)}
                        </TableCell>
                      )}

                      {columns.total && (
                        <TableCell className="text-right text-sm font-bold text-foreground">
                          {symbol}{Number(r.total || 0).toFixed(2)}
                        </TableCell>
                      )}

                      {columns.payment && (
                        <TableCell>
                          <div className="text-sm font-medium text-foreground leading-tight">
                            {getPaymentInfo(r)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {symbol}{Number(r.paid || 0).toFixed(2)} paid
                          </div>
                        </TableCell>
                      )}

                      {columns.status && (
                        <TableCell>
                          {r.status === 1 ? (
                            <Badge className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 font-semibold px-2 py-0.5 text-xs rounded-sm">
                              Paid
                            </Badge>
                          ) : r.status === 2 ? (
                            <Badge
                              variant="destructive"
                              className="font-semibold px-2 py-0.5 text-xs rounded-sm"
                            >
                              Voided
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="font-semibold px-2 py-0.5 text-xs rounded-sm"
                            >
                              Open
                            </Badge>
                          )}
                        </TableCell>
                      )}

                      {columns.actions && (
                        <TableCell className="text-right pr-4">
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
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-card text-xs text-muted-foreground">
          <div>
            Showing {filteredRows.length > 0 ? startIndex + 1 : 0}–
            {Math.min(startIndex + pageSize, filteredRows.length)} of {filteredRows.length} transactions
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded"
              disabled={currentPage <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const pNum = i + 1;
              if (
                totalPages > 6 &&
                pNum !== 1 &&
                pNum !== totalPages &&
                Math.abs(pNum - currentPage) > 1
              ) {
                if (pNum === 2 || pNum === totalPages - 1) {
                  return (
                    <span key={pNum} className="px-1 text-muted-foreground">
                      …
                    </span>
                  );
                }
                return null;
              }

              const isActive = pNum === currentPage;
              return (
                <Button
                  key={pNum}
                  variant={isActive ? 'default' : 'outline'}
                  size="icon"
                  className={`size-8 rounded text-xs font-medium ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'text-muted-foreground'
                  }`}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

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
