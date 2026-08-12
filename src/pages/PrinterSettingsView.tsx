import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Network,
  Printer,
  Smartphone,
  Usb,
} from 'lucide-react';
import { api, PrinterSettings } from '../api/client';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';

const INTERFACES = [
  { id: '', label: 'Off', description: 'Fall back to PDF/browser' },
  { id: 'usb', label: 'USB', description: 'Direct USB device file' },
  { id: 'network', label: 'Network', description: 'TCP/IP (e.g. ESC/POS over LAN)' },
];

function interfaceFields(kind: 'receipt' | 'kot', p: PrinterSettings) {
  const base = kind === 'receipt' ? p.interface : p.kotInterface;
  const usb = kind === 'receipt' ? p.usbDevice : p.kotUsbDevice;
  const host = kind === 'receipt' ? p.networkHost : p.kotNetworkHost;
  const port = kind === 'receipt' ? p.networkPort : p.kotNetworkPort;
  const width = kind === 'receipt' ? p.width : p.kotWidth;
  return { base, usb, host, port, width };
}

export default function PrinterSettingsView() {
  const [printer, setPrinter] = useState<PrinterSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await api.getPrinterSettings();
      setPrinter(res.printer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load printer settings');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = <K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) => {
    setPrinter((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!printer) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      await api.savePrinterSettings(printer);
      setSaved('Printer settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const InterfacePicker = ({ kind }: { kind: 'receipt' | 'kot' }) => {
    const { base } = interfaceFields(kind, printer!);
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        {INTERFACES.map((opt) => (
          <Button
            key={opt.id}
            type="button"
            variant={base === opt.id ? 'default' : 'outline'}
            onClick={() => {
              if (kind === 'receipt') set('interface', opt.id as PrinterSettings['interface']);
              else set('kotInterface', opt.id as PrinterSettings['kotInterface']);
            }}
            className="h-11 flex-col gap-1"
          >
            {opt.id === 'usb' ? (
              <Usb className="size-4" />
            ) : opt.id === 'network' ? (
              <Network className="size-4" />
            ) : (
              <Smartphone className="size-4" />
            )}
            <span className="text-xs">{opt.label}</span>
          </Button>
        ))}
      </div>
    );
  };

  const ConnectionFields = ({ kind }: { kind: 'receipt' | 'kot' }) => {
    const { base, usb, host, port } = interfaceFields(kind, printer!);
    const isUsb = base === 'usb';
    const isNet = base === 'network';
    return (
      <>
        {isUsb && (
          <div className="space-y-2">
            <Label className="text-xs">USB device</Label>
            <Input
              value={usb}
              onChange={(e) =>
                kind === 'receipt' ? set('usbDevice', e.target.value) : set('kotUsbDevice', e.target.value)
              }
              placeholder="/dev/usb/lp0"
              className="h-9 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Device path exposed by the OS (Linux usblp: <code>/dev/usb/lp0</code>).
            </p>
          </div>
        )}
        {isNet && (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs">Host</Label>
              <Input
                value={host}
                onChange={(e) =>
                  kind === 'receipt' ? set('networkHost', e.target.value) : set('kotNetworkHost', e.target.value)
                }
                placeholder="192.168.1.50"
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Port</Label>
              <Input
                type="number"
                value={port}
                onChange={(e) =>
                  kind === 'receipt'
                    ? set('networkPort', Number(e.target.value) || 9100)
                    : set('kotNetworkPort', Number(e.target.value) || 9100)
                }
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>
        )}
      </>
    );
  };

  const WidthPicker = ({ kind }: { kind: 'receipt' | 'kot' }) => {
    const { width } = interfaceFields(kind, printer!);
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Paper width</span>
        {([58, 80] as const).map((w) => (
          <Button
            key={w}
            type="button"
            size="sm"
            variant={width === w ? 'default' : 'outline'}
            onClick={() => (kind === 'receipt' ? set('width', w) : set('kotWidth', w))}
            className="h-8"
          >
            {w}mm
          </Button>
        ))}
      </div>
    );
  };

  if (!printer) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Printer className="size-4" />
        Loading printer settings…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Thermal Printing</CardTitle>
          <CardDescription>
            Receipts and kitchen tickets print to ESC/POS thermal printers. When no printer is
            configured, receipts fall back to the PDF/browser print path. Hardware verification is
            not possible in this build — confirm on a real printer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Printer className="size-5 text-primary" />
              <h3 className="text-sm font-semibold">Receipt printer</h3>
            </div>
            <InterfacePicker kind="receipt" />
            <ConnectionFields kind="receipt" />
            <WidthPicker kind="receipt" />
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Printer className="size-5 text-primary" />
              <h3 className="text-sm font-semibold">Kitchen ticket (KOT) printer</h3>
            </div>
            <InterfacePicker kind="kot" />
            <ConnectionFields kind="kot" />
            <WidthPicker kind="kot" />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={printer.autoPrintKot}
                onCheckedChange={(checked) => set('autoPrintKot', !!checked)}
              />
              Auto-print a kitchen ticket when a sale completes
            </label>
            <p className="text-xs text-muted-foreground">
              The KOT carries item lines and notes only — no prices or customer details.
            </p>
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving} className="gap-2">
              <Printer className="size-4" />
              {saving ? 'Saving…' : 'Save printer settings'}
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="size-4" />
                {saved}
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
