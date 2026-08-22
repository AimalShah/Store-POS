import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type Role } from '../api/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { highlight } from '../lib/highlight';

type UserRow = Awaited<ReturnType<typeof api.getUsers>>[number];

const ROLES: Role[] = ['Admin', 'Manager', 'Cashier'];

const ROLE_DESCRIPTION: Record<Role, string> = {
  Admin: 'Everything, including Team and Settings',
  Manager: 'Menu, Stock, Reports, Drawer — plus everything a Cashier can do',
  Cashier: 'Till: orders, payment, customers',
};

type Form = {
  id: string;
  username: string;
  password: string;
  pin: string;
  fullname: string;
  role: Role;
};

const EMPTY: Form = {
  id: '',
  username: '',
  password: '',
  pin: '',
  fullname: '',
  role: 'Cashier',
};

export default function TeamView() {
  const [list, setList] = useState<UserRow[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

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
      toast.success(form.id ? 'Team member updated' : 'Team member added');
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
      role: u.role ?? 'Cashier',
    });

  const remove = async (u: UserRow) => {
    try {
      await api.deleteUser(u.id);
      await load();
      toast.success(`${u.fullname || u.username} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{form.id ? 'Edit team member' : 'New team member'}</CardTitle>
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
            <Label htmlFor="role">Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as Role })}
            >
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[form.role]}</p>
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
          <Button type="button" onClick={save} disabled={busy}>
            {form.id ? 'Update' : 'Add'} team member
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
                <TableHead>Role</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium"><span className={highlight.blue}>{u.username}</span></TableCell>
                  <TableCell>{u.fullname}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'Admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                  </TableCell>
                  <TableCell>{u.has_pin ? 'Set' : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${u.username}`}
                      onClick={() => edit(u)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${u.username}`}
                      disabled={u.id === 1}
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.fullname || deleteTarget?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will immediately lose access to the system. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteTarget && remove(deleteTarget)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
