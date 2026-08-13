import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
  ReceiptText,
  Users,
  Warehouse,
} from 'lucide-react';
import { api } from '../api/client';
import { getPosBridge, isElectronBridge } from '../bridge';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Label } from '../components/ui/label';
import {
  buildCsv,
  buildWorkbook,
  catalogRows,
  customerRows,
  salesRows,
  stockRows,
  type ExportRow,
} from '../lib/export';

type Format = 'xlsx' | 'csv';
type DatasetId = 'sales' | 'catalog' | 'customers' | 'stock';

const PAYMENT_NAMES: Record<number, string> = { 1: 'Cash', 2: 'Card', 3: 'Mobile Wallet' };

const DATASETS: {
  id: DatasetId;
  label: string;
  description: string;
  icon: typeof Database;
}[] = [
  { id: 'sales', label: 'Sales', description: 'All transactions with items and payments', icon: ReceiptText },
  { id: 'catalog', label: 'Catalog', description: 'Products, prices, categories and stock', icon: Package },
  { id: 'customers', label: 'Customers', description: 'Customer names and contact details', icon: Users },
  { id: 'stock', label: 'Stock movements', description: 'Every restock, wastage and sale deduction', icon: Warehouse },
];

export default function ExportView() {
  const [selected, setSelected] = useState<Record<DatasetId, boolean>>({
    sales: true,
    catalog: true,
    customers: true,
    stock: true,
  });
  const [format, setFormat] = useState<Format>('xlsx');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const chosen = useMemo(() => DATASETS.filter((d) => selected[d.id]), [selected]);

  const fetchDataset = async (id: DatasetId) => {
    switch (id) {
      case 'sales':
        return salesRows(await api.getAllTransactions());
      case 'catalog':
        return catalogRows(await api.getProducts());
      case 'customers':
        return customerRows(await api.getCustomers());
      case 'stock': {
        const [movements, products] = await Promise.all([
          api.getStockMovements({ limit: 100000 }),
          api.getProducts(),
        ]);
        return stockRows(movements.movements, products);
      }
    }
  };

  const dateStamp = () => new Date().toISOString().slice(0, 10);

  const toBase64 = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin);
  };

  const SHEET_NAMES: Record<DatasetId, string> = {
    sales: 'Sales',
    catalog: 'Catalog',
    customers: 'Customers',
    stock: 'Stock movements',
  };

  const exportXlsx = async (rowsByDataset: Record<string, Record<string, unknown>[]>) => {
    const workbook = buildWorkbook(
      chosen.map((d) => ({
        name: SHEET_NAMES[d.id],
        rows: (rowsByDataset[d.id] || []) as ExportRow[],
      }))
    );
    const data = Buffer.from(workbook).toString('base64');
    const bridge = getPosBridge();
    return bridge.saveFile({
      defaultName: `store-export-${dateStamp()}.xlsx`,
      type: 'xlsx',
      data,
    });
  };

  const exportCsv = async (rowsByDataset: Record<string, Record<string, unknown>[]>) => {
    const bridge = getPosBridge();
    const results: { filePath?: string; canceled?: boolean }[] = [];
    for (const d of chosen) {
      const rows = rowsByDataset[d.id];
      if (!rows.length) continue;
      const headers = Object.keys(rows[0]);
      const csv = buildCsv(headers, rows.map((r) => headers.map((h) => (r[h] as string | number) ?? '')));
      results.push(
        await bridge.saveFile({
          defaultName: `store-${d.id}-${dateStamp()}.csv`,
          type: 'csv',
          data: toBase64(csv),
        })
      );
    }
    return results[results.length - 1] || { ok: true, canceled: true };
  };

  const runExport = async () => {
    setMessage(null);
    if (!chosen.length) {
      setMessage({ ok: false, text: 'Select at least one dataset to export.' });
      return;
    }
    setExporting(true);
    try {
      const rowsByDataset: Record<string, Record<string, unknown>[]> = {};
      for (const d of chosen) {
        rowsByDataset[d.id] = (await fetchDataset(d.id)) as Record<string, unknown>[];
      }
      const result = format === 'xlsx' ? await exportXlsx(rowsByDataset) : await exportCsv(rowsByDataset);
      if (result.canceled) {
        setMessage({ ok: true, text: 'Export cancelled.' });
      } else {
        const files = format === 'csv' ? chosen.filter((d) => rowsByDataset[d.id].length).length : 1;
        setMessage({
          ok: true,
          text: `Exported ${files} file${files === 1 ? '' : 's'} to ${result.filePath}`,
        });
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Pick datasets and a format. Files are written locally with a native save dialog
            {isElectronBridge() ? '' : ' (browser download fallback)'}; no network involved.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Datasets</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {DATASETS.map((d) => (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/10 has-data-checked:border-primary"
                >
                  <Checkbox
                    checked={selected[d.id]}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => ({ ...prev, [d.id]: !!checked }))
                    }
                  />
                  <div className="flex items-start gap-3">
                    <d.icon className="mt-0.5 size-5 shrink-0 text-primary/70" />
                    <div>
                      <div className="text-sm font-medium leading-tight">{d.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{d.description}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Format</Label>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2">
              <Button
                type="button"
                variant={format === 'xlsx' ? 'default' : 'outline'}
                onClick={() => setFormat('xlsx')}
                className="h-11 flex-col gap-1"
              >
                <FileSpreadsheet className="size-5" />
                <span className="text-xs">Excel (.xlsx)</span>
              </Button>
              <Button
                type="button"
                variant={format === 'csv' ? 'default' : 'outline'}
                onClick={() => setFormat('csv')}
                className="h-11 flex-col gap-1"
              >
                <FileText className="size-5" />
                <span className="text-xs">CSV (per dataset)</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={runExport}
                    disabled={exporting}
                    size="icon"
                    aria-label="Export"
                  >
                    {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  </Button>
                }
              />
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
            {format === 'xlsx' && (
              <span className="text-xs text-muted-foreground">One workbook with a sheet per dataset.</span>
            )}
            {format === 'csv' && (
              <span className="text-xs text-muted-foreground">A separate file per dataset.</span>
            )}
          </div>

          {message && (
            <div
              className={`flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${
                message.ok
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-destructive/20 bg-destructive/10 text-destructive'
              }`}
            >
              {!message.ok && <AlertCircle className="size-4 shrink-0" />}
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
