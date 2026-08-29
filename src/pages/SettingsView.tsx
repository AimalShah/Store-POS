import { useEffect, useState } from 'react';
import { Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { api, Settings } from '../api/client';
import PhotoPicker from '../components/PhotoPicker';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Separator } from '../components/ui/separator';
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
import { applyTheme, isThemeId, DEFAULT_THEME, THEME_IDS, THEME_LABELS } from '../lib/theme';

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
    theme: DEFAULT_THEME,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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
      theme: isThemeId(settings?.theme) ? settings.theme : DEFAULT_THEME,
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
      applyTheme(isThemeId(form.theme) ? form.theme : 'mono');

      await api.saveSettings(fd);

      setMessage('Settings saved.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const resetAllData = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await api.resetAllData();
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Reset failed');
      setResetting(false);
      setResetOpen(false);
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
            <div className="space-y-2">
              <Label>Theme preset</Label>
              <div className="flex gap-2">
                {THEME_IDS.map((id) => {
                  const selected = form.theme === id;
                  return (
                    <Button
                      key={id}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => {
                        setForm({ ...form, theme: id });
                        applyTheme(id);
                      }}
                      className={`flex-1 gap-1.5 ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    >
                      {selected && <Check className="size-4" />}
                      {THEME_LABELS[id]}
                    </Button>
                  );
                })}
              </div>
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

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Start as new</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Writes a CSV backup of every sale, product, category, customer, shift,
            drawer session, stock record and audit entry to this computer's backup
            folder, then deletes all of that data. Store details, printer setup and
            user accounts are kept — you will just be signed out.
          </p>
          {resetError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {resetError}
            </div>
          )}
          <Button variant="destructive" onClick={() => setResetOpen(true)}>
            <RotateCcw className="size-4" />
            Start as new
          </Button>
        </div>

        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start as new?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes all sales, products, categories, customers, shifts,
                drawer sessions, stock and media forever. A CSV backup of
                everything is written to the backup folder first. Store details,
                printer config and user logins are kept. You will be signed out.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={resetAllData}
                disabled={resetting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {resetting ? 'Starting…' : 'Start as new'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
