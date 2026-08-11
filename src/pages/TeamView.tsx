import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

type UserRow = Awaited<ReturnType<typeof api.getUsers>>[number];

type Form = {
  id: string;
  username: string;
  password: string;
  pin: string;
  fullname: string;
  perm_products: boolean;
  perm_categories: boolean;
  perm_transactions: boolean;
  perm_users: boolean;
  perm_settings: boolean;
};

const EMPTY: Form = {
  id: '',
  username: '',
  password: '',
  pin: '',
  fullname: '',
  perm_products: true,
  perm_categories: true,
  perm_transactions: true,
  perm_users: false,
  perm_settings: false,
};

type PermKey =
  | 'perm_products'
  | 'perm_categories'
  | 'perm_transactions'
  | 'perm_users'
  | 'perm_settings';

const PERMS: { key: PermKey; label: string }[] = [
  ['perm_products', 'Catalog products'],
  ['perm_categories', 'Categories'],
  ['perm_transactions', 'Sales history'],
  ['perm_users', 'Team'],
  ['perm_settings', 'Settings'],
].map(([key, label]) => ({ key: key as PermKey, label }));

export default function TeamView() {
  const [list, setList] = useState<UserRow[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => setList(await api.getUsers());

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const save = async () => {
    setError(null);
    if (!form.username.trim() || !form.fullname.trim()) {
      setError('Username and full name are required');
      return;
    }
    if (!form.id && !form.password) {
      setError('Password is required for new users');
      return;
    }
    if (form.pin && !/^\d{4,6}$/.test(form.pin)) {
      setError('PIN must be 4–6 digits (or blank to clear)');
      return;
    }
    setBusy(true);
    try {
      await api.saveUser({ ...form });
      await load();
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const edit = (u: UserRow) =>
    setForm({
      id: String(u.id),
      username: u.username,
      password: '',
      pin: '',
      fullname: u.fullname,
      perm_products: !!u.perm_products,
      perm_categories: !!u.perm_categories,
      perm_transactions: !!u.perm_transactions,
      perm_users: !!u.perm_users,
      perm_settings: !!u.perm_settings,
    });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{form.id ? 'Edit user' : 'New user'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fullname">Full name</Label>
            <Input
              id="fullname"
              value={form.fullname}
              onChange={(e) => setForm({ ...form, fullname: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password {form.id ? '(blank = keep)' : ''}</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pin">
              PIN {form.id ? '(blank = keep)' : ''} <span className="text-muted-foreground">— 4–6 digits, used at the till</span>
            </Label>
            <Input
              id="pin"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={form.id && list.find((u) => u.id === Number(form.id))?.has_pin ? 'Set to change' : ''}
              value={form.pin}
              onChange={(e) =>
                setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            {PERMS.map(({ key, label }) => (
              <Label key={key} className="flex items-center gap-2 font-normal">
                <Checkbox
                  checked={form[key]}
                  onCheckedChange={(checked) => setForm({ ...form, [key]: !!checked })}
                />
                {label}
              </Label>
            ))}
          </div>
          <Button type="button" onClick={save} disabled={busy}>
            {form.id ? 'Update' : 'Add'} user
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.fullname}</TableCell>
                  <TableCell>{u.has_pin ? 'Set' : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => edit(u)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
