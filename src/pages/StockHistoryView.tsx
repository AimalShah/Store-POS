import { useEffect, useState } from 'react';
import { api, Product, StockMovement, StockMovementsResponse } from '../api/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { highlight } from '../lib/highlight';
import { Calendar } from 'lucide-react';

type Props = {
  products: Product[];
  symbol: string;
};

export default function StockHistoryView({ products, symbol }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [filters, setFilters] = useState({
    productId: '',
    type: '',
    startDate: '',
    endDate: '',
  });

  const loadMovements = async (pageNum = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        limit: pageSize,
        offset: pageNum * pageSize,
      };
      if (filters.productId) params.productId = parseInt(filters.productId, 10);
      if (filters.type) params.type = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res: StockMovementsResponse = await api.getStockMovements(params);
      setMovements(res.movements);
      setTotal(res.total);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements(0);
  }, [filters]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'sale':
        return <Badge variant="default">Sale</Badge>;
      case 'restock':
        return <Badge variant="secondary">Restock</Badge>;
      case 'wastage':
        return <Badge variant="destructive">Wastage</Badge>;
      case 'adjustment':
        return <Badge variant="outline">Adjustment</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock History</h1>
          <p className="text-muted-foreground">View all stock movements including sales, restocks, wastage, and adjustments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter stock movements by product, type, and date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filter-product">Product</Label>
              <Select value={filters.productId} onValueChange={(v) => handleFilterChange('productId', v || '')}>
                <SelectTrigger id="filter-product">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All products</SelectItem>
                  {products.filter((p) => p.trackStock).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-type">Movement Type</Label>
              <Select value={filters.type} onValueChange={(v) => handleFilterChange('type', v || '')}>
                <SelectTrigger id="filter-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="restock">Restock</SelectItem>
                  <SelectItem value="wastage">Wastage</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-start">From Date</Label>
              <Input
                id="filter-start"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-end">To Date</Label>
              <Input
                id="filter-end"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setFilters({ productId: '', type: '', startDate: '', endDate: '' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock Movements ({total} total)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-destructive text-sm">{error}</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Date / Time</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-28 text-right">Change</TableHead>
                <TableHead className="w-28 text-right">After</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-32">User</TableHead>
                <TableHead className="w-32">Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No stock movements found
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">
                      {new Date(m.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{m.productName || ''}</TableCell>
                    <TableCell>{getTypeBadge(m.type)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span className={m.quantityChange > 0 ? highlight.green : m.quantityChange < 0 ? highlight.red : highlight.slate}>
                        {m.quantityChange > 0 ? '+' : ''}{m.quantityChange}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm"><span className={highlight.blue}>{m.quantityAfter}</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {m.reason || '—'}
                    </TableCell>
                    <TableCell className="text-sm">{m.userName || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.referenceType === 'transaction' && m.referenceId ? (
                        <span className="font-mono">TXN #{m.referenceId}</span>
                      ) : (
                        m.referenceType || '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadMovements(page - 1)}
                  disabled={page === 0 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadMovements(page + 1)}
                  disabled={page >= totalPages - 1 || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}