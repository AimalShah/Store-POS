import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Network,
  Printer,
  RefreshCw,
  Smartphone,
  Usb,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, PrinterSettings } from '../api/client';
import type { DetectedPrinter } from '../vite-env';
import { getPosBridge } from '../bridge';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';

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
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedPrinter[]>([]);
  const [detecting, setDetecting] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await api.getPrinterSettings();
      setPrinter(res.printer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load printer settings');
    }
  };

  const detectPrinters = useCallback(async (silent = false) => {
    if (!silent) setDetecting(true);
    try {
      const list = await getPosBridge().listUsbPrinters();
      setDetected(list);
    } catch {
      /* USB detection only works inside the desktop app on Windows */
    } finally {
      if (!silent) setDetecting(false);
    }
  }, []);

  useEffect(() => {
    load();
    detectPrinters();
    // A newly plugged-in printer is picked up by the main process's
    // hotplug watcher; re-run detection and, if it auto-claimed the
    // receipt slot, reload settings so the form reflects it.
    getPosBridge().onUsbPrinterDetected(({ name, autoAssigned }) => {
      detectPrinters(true);
      if (autoAssigned) {
        toast.success(`Printer detected: ${name}`, {
          description: 'Set as the receipt printer automatically.',
        });
        load();
      } else {
        toast.info(`Printer detected: ${name}`, {
          description: 'Select it below to use it.',
        });
      }
    });
  }, [detectPrinters]);

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

  const testPrint = async () => {
    if (!printer) return;
    if (!printer.interface) {
      setError('No printer configured. Set up a printer first.');
      return;
    }
    setTesting(true);
    setError(null);
    setSaved(null);
    try {
      const res = await api.testPrinter();
      setSaved(`Test print sent: ${res.message}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test print failed');
    } finally {
      setTesting(false);
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
    const setUsb = (value: string | null) =>
      kind === 'receipt' ? set('usbDevice', value || '') : set('kotUsbDevice', value || '');
    return (
      <>
        {isUsb && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">USB printer</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => detectPrinters()}
                disabled={detecting}
                className="h-7 gap-1.5 text-xs"
              >
                <RefreshCw className={`size-3.5 ${detecting ? 'animate-spin' : ''}`} />
                {detecting ? 'Detecting…' : 'Detect printers'}
              </Button>
            </div>
            {detected.length > 0 ? (
              <Select value={usb || undefined} onValueChange={setUsb}>
                <SelectTrigger className="h-9 w-full text-xs">
                  <SelectValue placeholder="Select the plugged-in printer" />
                </SelectTrigger>
                <SelectContent>
                  {detected.map((p) => (
                    <SelectItem key={p.name} value={p.name} className="text-xs">
                      <span className="flex items-center gap-2">
                        {p.name}
                        {p.likelyThermal && (
                          <Badge variant="secondary" className="text-[10px]">
                            Receipt printer
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {detected.length > 0
                ? 'Plug the printer in via USB and it appears here automatically — pick it and save.'
                : 'No installed Windows printer queues were found. Check that the printer is connected, powered on, and has its Windows driver installed, then detect again.'}
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

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={save} disabled={saving} className="gap-2">
              <Printer className="size-4" />
              {saving ? 'Saving…' : 'Save printer settings'}
            </Button>
            <Button
              variant="outline"
              onClick={testPrint}
              disabled={testing || !printer?.interface}
              className="gap-2"
            >
              <Printer className="size-4" />
              {testing ? 'Testing…' : 'Test Print'}
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
