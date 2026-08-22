import { useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Banknote,
  Download,
  Package,
  ReceiptText,
  ShoppingBag,
  Trophy,
  Car,
} from 'lucide-react';
import { api, ReportSummary } from '../api/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { localInputToIso, monthRange } from '../lib/dates';
import { downloadCsv } from '../lib/export';
import { highlight } from '../lib/highlight';

type Props = {
  symbol: string;
};

export default function ReportsView({ symbol }: Props) {
  const initial = monthRange();
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReportSummary({
        start: localInputToIso(start),
        end: localInputToIso(end, true),
      });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount; Apply refreshes
  }, []);

  const exportCsv = () => {
    if (!report) return;
    const s = report.summary;
    const header = ['Section', 'Label', 'Count', 'Amount'];
    const rows: (string | number)[][] = [
      ['Summary', 'Sales', s.saleCount, s.totalSales.toFixed(2)],
      ['Summary', 'Items sold', s.itemsSold, ''],
      ['Summary', 'Subtotal', '', s.subtotal.toFixed(2)],
      ['Summary', 'Discount', '', `-${s.discount.toFixed(2)}`],
      ['Summary', 'Tax', '', s.tax.toFixed(2)],
      ...report.byCategory.map((c) => [
        'By category',
        c.category,
        c.count,
        c.revenue.toFixed(2),
      ]),
      ...report.byPaymentMethod.map((p) => [
        'By payment method',
        p.method.charAt(0).toUpperCase() + p.method.slice(1),
        p.count,
        p.amount.toFixed(2),
      ]),
      ...report.bestSellers.map((b) => [
        'Best seller',
        b.name,
        b.quantity,
        b.revenue.toFixed(2),
      ]),
    ];
    downloadCsv(`report-${start.slice(0, 10)}-to-${end.slice(0, 10)}.csv`, header, rows);
  };

  const summaryCards = report && [
    { label: 'Total Sales', value: `${symbol}${report.summary.totalSales.toFixed(2)}`, icon: ReceiptText },
    { label: 'Sales', value: String(report.summary.saleCount), icon: ShoppingBag },
    { label: 'Items Sold', value: String(report.summary.itemsSold), icon: Package },
    { label: 'Tax', value: `${symbol}${report.summary.tax.toFixed(2)}`, icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col gap-6">
       <div className="space-y-4 ">
         <h1 className='text-2xl font-semibold'>Reports</h1>
         <p className='text-muted-foreground text-sm font-normal'>
           Sales totals by category and payment method, plus best sellers, for the chosen date range.
         </p>
       </div>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 py-4">
          <div className='text-left w-full'>
           <CardTitle>Choose dates</CardTitle>
           <CardDescription>select a date range to view your sales report</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="report-from">From</Label>
              <Input
                id="report-from"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-56"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-to">To</Label>
              <Input
                id="report-to"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-56"
              />
            </div>
            <Button onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Apply'}
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon" aria-label="Export CSV" onClick={exportCsv} disabled={!report || loading}>
                    <Download className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards?.map((card) => (
              <Card key={card.label}>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold">{card.value}</p>
                  </div>
                  <card.icon className="size-8 text-primary/70" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="size-4 text-primary" />
                  Top items
                </CardTitle>
                <CardDescription>Most sold items in the range.</CardDescription>
              </CardHeader>
              <CardContent>
                {report.bestSellers.length ? (
                  <div className="max-h-72 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Items sold</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.bestSellers.map((b, i) => (
                          <TableRow key={b.productId ?? b.name}>
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium">{b.name}</TableCell>
                            <TableCell className="text-right"><span className={highlight.blue}>{b.quantity}</span></TableCell>
                            <TableCell className="text-right font-semibold">
                              <span className={highlight.green}>{symbol}{b.revenue.toFixed(2)}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No sales in this range.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Banknote className="size-4 text-primary" />
                  Payment totals
                </CardTitle>
                <CardDescription>Collected amount per method.</CardDescription>
              </CardHeader>
              <CardContent>
                {report.byPaymentMethod.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.byPaymentMethod.map((p) => (
                        <TableRow key={p.method}>
                          <TableCell className="capitalize font-medium">{p.method}</TableCell>
                          <TableCell className="text-right">{p.count}</TableCell>
                          <TableCell className="text-right font-semibold">
                            <span className={highlight.green}>{symbol}{p.amount.toFixed(2)}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No sales in this range.</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-4 text-primary" />
                  Totals by Category
                </CardTitle>
                <CardDescription>Items and revenue grouped by product category.</CardDescription>
              </CardHeader>
              <CardContent>
                {report.byCategory.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.byCategory.map((c) => {
                        const share = report.summary.totalSales
                          ? (c.revenue / report.summary.totalSales) * 100
                          : 0;
                        return (
                          <TableRow key={c.category}>
                            <TableCell className="font-medium">{c.category}</TableCell>
                            <TableCell className="text-right">{c.count}</TableCell>
                            <TableCell className="text-right font-semibold">
                              <span className={highlight.green}>{symbol}{c.revenue.toFixed(2)}</span>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              <span className={highlight.blue}>{share.toFixed(1)}%</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No sales in this range.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
