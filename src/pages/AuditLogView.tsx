import { useEffect, useState } from 'react';
import { api, AuditLog, AuditLogResponse, User } from '../api/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Calendar, Loader2 } from 'lucide-react';

type Props = {
  canSettings: boolean;
};

export default function AuditLogView({ canSettings }: Props) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!canSettings) return;
    api
      .getUsers()
      .then((list) => setUsers(list))
      .catch(() => setUsers([]));
  }, [canSettings]);

  if (!canSettings) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-destructive">Access denied. Requires the Admin role.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [filters, setFilters] = useState({
    userId: '',
    entityType: '',
    startDate: '',
    endDate: '',
  });

  const entityTypes = ['transaction', 'product', 'customer', 'user', 'settings', 'category', 'shift', 'drawer_session'];

  const loadLogs = async (pageNum = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        limit: pageSize,
        offset: pageNum * pageSize,
      };
      if (filters.userId) params.userId = parseInt(filters.userId, 10);
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res: AuditLogResponse = await api.getAuditLog(params);
      setLogs(res.logs);
      setTotal(res.total);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(0);
  }, [filters]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return <Badge variant="secondary">Created</Badge>;
      case 'update':
        return <Badge variant="default">Updated</Badge>;
      case 'delete':
        return <Badge variant="destructive">Deleted</Badge>;
      case 'void':
        return <Badge variant="outline">Voided</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getEntityLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      transaction: 'Transaction',
      product: 'Product',
      customer: 'Customer',
      user: 'User',
      settings: 'Settings',
      category: 'Category',
      shift: 'Shift',
      drawer_session: 'Drawer Session',
    };
    return labels[entityType] || entityType;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">View all system changes including creates, updates, deletes, and voids</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter audit log by user, entity type, and date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filter-user">User</Label>
              <Select value={filters.userId} onValueChange={(v) => handleFilterChange('userId', v || '')}>
                <SelectTrigger id="filter-user">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.fullname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-entity">Entity Type</Label>
              <Select value={filters.entityType} onValueChange={(v) => handleFilterChange('entityType', v || '')}>
                <SelectTrigger id="filter-entity">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {entityTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {getEntityLabel(t)}
                    </SelectItem>
                  ))}
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
            <Button variant="outline" onClick={() => setFilters({ userId: '', entityType: '', startDate: '', endDate: '' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log ({total} total)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-destructive text-sm">{error}</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Date / Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-28">Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="w-32">Entity ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No audit log entries found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{log.userName || '—'}</TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>{getEntityLabel(log.entityType)}</TableCell>
                    <TableCell className="font-mono text-sm">{log.entityId ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.newValue ? JSON.stringify(log.newValue).slice(0, 100) : log.oldValue ? JSON.stringify(log.oldValue).slice(0, 100) : '—'}
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
                  onClick={() => loadLogs(page - 1)}
                  disabled={page === 0 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadLogs(page + 1)}
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