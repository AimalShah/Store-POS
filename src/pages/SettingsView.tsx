import { useEffect, useState } from 'react';
import { api, Settings } from '../api/client';
import PhotoPicker from '../components/PhotoPicker';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
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

type Props = {
  settings: Settings | null;
  onSaved: () => Promise<void>;
};

export default function SettingsView({ settings, onSaved }: Props) {
  const [form, setForm] = useState({
    store: '',
    address_one: '',
    address_two: '',
    contact: '',
    tax: '',
    symbol: 'Rs',
    percentage: '0',
    charge_tax: false,
    footer: '',
    img: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setForm({
      store: settings?.store || '',
      address_one: settings?.address_one || '',
      address_two: settings?.address_two || '',
      contact: settings?.contact || '',
      tax: settings?.tax || '',
      symbol: settings?.symbol || 'Rs',
      percentage: String(settings?.percentage ?? 0),
      charge_tax: !!settings?.charge_tax,
      footer: settings?.footer || '',
      img: settings?.img || '',
    });
  }, [settings]);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'charge_tax') fd.append(k, form.charge_tax ? '1' : '0');
        else fd.append(k, String(v));
      });

      await api.saveSettings(fd);

      setMessage('Settings saved.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const seedDemo = async () => {
    setError(null);
    setMessage(null);
    setDemoBusy(true);
    try {
      const result = await api.seedDemo();
      setMessage(result.message);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setDemoBusy(false);
    }
  };

  const clearDemo = async () => {
    setConfirmClear(false);
    setError(null);
    setMessage(null);
    setDemoBusy(true);
    try {
      const result = await api.clearDemo();
      setMessage(result.message);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md border border-primary/50 bg-primary/10 px-4 py-2 text-sm text-primary">
            {message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Store</h3>
            <div className="space-y-2">
              <Label htmlFor="set-store">Store name</Label>
              <Input
                id="set-store"
                value={form.store}
                onChange={(e) => setForm({ ...form, store: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-addr1">Address</Label>
              <Input
                id="set-addr1"
                value={form.address_one}
                onChange={(e) => setForm({ ...form, address_one: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-addr2">Address line 2</Label>
              <Input
                id="set-addr2"
                value={form.address_two}
                onChange={(e) => setForm({ ...form, address_two: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-contact">Contact</Label>
              <Input
                id="set-contact"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-footer">Receipt footer</Label>
              <Textarea
                id="set-footer"
                rows={2}
                value={form.footer}
                onChange={(e) => setForm({ ...form, footer: e.target.value })}
              />
            </div>
            <PhotoPicker
              label="Store logo"
              value={form.img}
              onChange={(img) => setForm({ ...form, img })}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Till</h3>
            <div className="space-y-2">
              <Label htmlFor="set-symbol">Currency symbol</Label>
              <Input
                id="set-symbol"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="set-tax"
                checked={form.charge_tax}
                onCheckedChange={(c) => setForm({ ...form, charge_tax: c === true })}
              />
              <Label htmlFor="set-tax">Charge tax on sales</Label>
            </div>
            {form.charge_tax && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="set-taxlabel">Tax label</Label>
                  <Input
                    id="set-taxlabel"
                    value={form.tax}
                    onChange={(e) => setForm({ ...form, tax: e.target.value })}
                    placeholder="VAT"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="set-taxpct">Tax %</Label>
                  <Input
                    id="set-taxpct"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.percentage}
                    onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                  />
                </div>
              </>
            )}
            <p className="text-sm text-muted-foreground">
              This till runs fully offline on this computer.
            </p>
          </div>
        </div>

        <Button onClick={save}>Save settings</Button>

        <div className="space-y-3 border-t pt-4">
          <h3 className="text-lg font-semibold">Demo data</h3>
          <p className="mt-0 text-sm text-muted-foreground">
            Seed a sample South African catalog (categories, products, customers), or wipe catalog and
            sales data for a clean slate. Staff and settings are kept.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={demoBusy} onClick={seedDemo}>
              Seed demo catalog
            </Button>
            <Button variant="destructive" disabled={demoBusy} onClick={() => setConfirmClear(true)}>
              Bulk delete catalog &amp; sales
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all catalog &amp; sales data?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes ALL products, categories, sales history, and customers (except Walk-in).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearDemo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
