import { useEffect, useState } from 'react';
import { api, Customer } from '../api/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { highlight } from '../lib/highlight';
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
import { Pencil, Trash2, UserPlus } from 'lucide-react';

type Props = {
  customers: Customer[];
  onChanged: () => Promise<void>;
  canManage?: boolean;
};

type FormState = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
};

const emptyForm: FormState = { id: '', name: '', phone: '', email: '', address: '' };

export default function CustomersView({ customers, onChanged, canManage = true }: Props) {
  const [list, setList] = useState<Customer[]>(customers);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setList(customers), [customers]);

  const isEditing = !!form.id;

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await api.updateCustomer({
          _id: form.id,
          id: Number(form.id),
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
        });
      } else {
        await api.saveCustomer({
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
        });
      }
      setForm(emptyForm);
      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: Customer) => {
    setForm({
      id: String(c.id),
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
    });
  };

  const remove = async () => {
    if (pendingId === null) return;
    await api.deleteCustomer(pendingId);
    setPendingId(null);
    await onChanged();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canManage && (
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit customer' : 'New customer'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cust-name">Name</Label>
            <Input
              id="cust-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-phone">Phone</Label>
            <Input
              id="cust-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-email">Email</Label>
            <Input
              id="cust-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-address">Address</Label>
            <Textarea
              id="cust-address"
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street, city"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              <UserPlus className="size-4 mr-1.5" />
              {isEditing ? 'Update' : 'Add'} customer
            </Button>
            {isEditing && (
              <Button variant="outline" onClick={() => setForm(emptyForm)} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No customers yet. Add one to get started.
            </p>
          ) : (
            <div className="max-h-[80vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium"><span className={highlight.blue}>{c.name}</span></TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell>{c.email || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.address || '—'}</TableCell>
                    <TableCell>
                      {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${c.name}`}
                          onClick={() => setPendingId(c.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingId !== null} onOpenChange={(open) => !open && setPendingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the customer. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
