import { createRequire } from 'module';
import { printer as ThermalPrinter, types } from 'node-thermal-printer';
import { getDb } from '../server/db.js';

const require = createRequire(import.meta.url);

// Thermal printing runs in the Electron main process (Node), where it can
// talk to USB device files and the network. The renderer never prints
// directly; it asks via IPC and falls back to PDF/browser when unconfigured.

// Windows has no raw "/dev/usb/lp0"-style device file for USB printers —
// a plugged-in receipt printer shows up as a print-spooler queue instead.
// We lazily require the native `printer` module (winspool bindings) only
// when we're actually on win32, so Linux/macOS dev machines never need to
// build it.
let winSpooler = null;
function getWinSpooler() {
  if (process.platform !== 'win32') return null;
  if (winSpooler) return winSpooler;
  try {
    winSpooler = require('@thiagoelg/node-printer');
    console.log('Successfully loaded node-printer');
  } catch (err) {
    console.error('Windows printer driver module unavailable:', err);
    winSpooler = null;
  }
  return winSpooler;
}

// Heuristic used to pick out likely receipt/thermal printers from the full
// list of Windows-installed print queues (which also includes "Microsoft
// Print to PDF", scanners, regular office printers, etc.).
const THERMAL_NAME_HINTS = [
  'pos', 'thermal', 'receipt', 'tm-', 'tm ', 'epson tm', 'star', 'xprinter',
  'xp-', 'zjiang', 'gprinter', 'rongta', 'citizen', 'bixolon', 'sewoo',
  '58mm', '80mm', 'ticket', 'kot',
];

export function isLikelyThermalPrinterName(name) {
  const n = String(name || '').toLowerCase();
  return THERMAL_NAME_HINTS.some((hint) => n.includes(hint));
}

// List the printers Windows currently knows about (installed queues).
// Plugging in most USB receipt printers causes Windows to auto-create a
// queue for them within a second or two once a driver is available —
// either a vendor driver or the generic/text-only class driver — so this
// list is effectively "what's plugged in and usable" on Windows.
export function listSystemPrinters() {
  const spooler = getWinSpooler();
  if (!spooler) {
    console.log('listSystemPrinters: No spooler available');
    return [];
  }
  try {
    const printers = spooler.getPrinters() || [];
    console.log('listSystemPrinters found:', printers.map(p => p.name));
    return printers.map((p) => ({
      name: p.name,
      status: p.status || '',
      isDefault: !!p.isDefault,
      likelyThermal: isLikelyThermalPrinterName(p.name),
    }));
  } catch (err) {
    console.error('Failed to list system printers:', err);
    return [];
  }
}

export function readPrinterConfig() {
  const row = getDb().prepare('SELECT * FROM printer_settings WHERE id = 1').get();
  if (!row) return null;
  return {
    receipt: {
      interface: row.interface || '',
      usbDevice: row.usb_device || '',
      networkHost: row.network_host || '',
      networkPort: row.network_port || 9100,
      width: row.width || 58,
    },
    kot: {
      interface: row.kot_interface || '',
      usbDevice: row.kot_usb_device || '',
      networkHost: row.kot_network_host || '',
      networkPort: row.kot_network_port || 9100,
      width: row.kot_width || 58,
    },
    autoPrintKot: !!row.auto_print_kot,
  };
}

// Called by the hotplug watcher when a new likely-thermal printer queue
// shows up in Windows. Only claims it as the receipt printer if nothing is
// configured yet — never silently overrides a printer the user already set
// up on purpose.
export function autoAssignReceiptPrinterIfEmpty(name) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM printer_settings WHERE id = 1').get();
  const alreadyConfigured = row && row.interface && (row.interface !== 'usb' || row.usb_device);
  if (alreadyConfigured) return false;
  if (row) {
    db.prepare(
      `UPDATE printer_settings SET interface = 'usb', usb_device = ? WHERE id = 1`
    ).run(name);
  } else {
    db.prepare(
      `INSERT INTO printer_settings (id, interface, usb_device) VALUES (1, 'usb', ?)`
    ).run(name);
  }
  return true;
}

export function interfaceUri(conf) {
  // Manual override: if a manual printer name is provided in usbDevice
  // and we are on Windows, we force the printer: prefix.
  if (conf.interface === 'usb' && conf.usbDevice && process.platform === 'win32') {
    return `printer:${conf.usbDevice}`;
  }

  if (conf.interface === 'network') {
    return conf.networkHost ? `tcp://${conf.networkHost}:${conf.networkPort || 9100}` : '';
  }
  if (conf.interface === 'usb') {
    if (!conf.usbDevice) return '';
    return conf.usbDevice;
  }
  return '';
}

export function makePrinter(conf) {
  const uri = interfaceUri(conf);
  if (!uri) return null;
  const options = {
    type: types.EPSON,
    interface: uri,
    width: conf.width === 80 ? 48 : 32,
    lineCharacter: '=',
  };
  if (conf.interface === 'usb' && process.platform === 'win32') {
    const spooler = getWinSpooler();
    if (!spooler) return null; // driver module missing/failed to build
    options.driver = spooler;
  }
  return new ThermalPrinter(options);
}

function money(n, symbol) {
  return `${symbol}${Number(n || 0).toFixed(2)}`;
}

function cap(value) {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Bill header shows only the sequence tail of INV-YYYYMMDD-NNN refs (e.g. 013).
function orderNumber(tx) {
  const m = String(tx.ref_number ?? '').match(/(\d+)\s*$/);
  return m ? m[1].slice(-3).padStart(3, '0') : String(tx.id ?? '');
}

function centered(printer, text) {
  printer.alignCenter();
  printer.println(text);
  printer.alignLeft();
}

export function writeReceipt(printer, tx, settings) {
  const symbol = settings?.symbol || 'Rs';
  const isVoided = Number(tx.status) === 2;

  printer.bold(true);
  printer.alignCenter();
  printer.println(settings?.store || 'Store POS');
  printer.bold(false);
  printer.alignLeft();

  if (settings?.address_one) centered(printer, settings.address_one);
  if (settings?.address_two) centered(printer, settings.address_two);
  if (settings?.contact) centered(printer, settings.contact);
  printer.newLine();

  printer.drawLine();
  printer.bold(true);
  printer.alignCenter();
  printer.println(`ORDER #${orderNumber(tx)}`);
  printer.bold(false);
  printer.alignLeft();
  if (isVoided) {
    printer.bold(true);
    printer.alignCenter();
    printer.println('*** VOIDED ***');
    printer.bold(false);
    printer.alignLeft();
  }
  centered(printer, new Date(tx.date).toLocaleString());
  centered(printer, `Cashier: ${tx.user || '-'}`);
  centered(printer, `Customer: ${tx.customer_name || 'Walk-in'}`);
  if (tx.fulfillment) centered(printer, `Fulfillment: ${cap(tx.fulfillment)}`);
  if (tx.fulfillment === 'delivery') {
    if (tx.delivery_name) centered(printer, `Name: ${tx.delivery_name}`);
    if (tx.delivery_contact) centered(printer, `Contact: ${tx.delivery_contact}`);
    if (tx.delivery_address) centered(printer, `Address: ${tx.delivery_address}`);
  }
  printer.newLine();

  printer.drawLine();
  for (const item of tx.items || []) {
    printer.println(`${item.quantity}x ${item.name}`);
    if (item.note) printer.println(`   ${item.note}`);
    for (const v of item.selectedVariants || []) {
      printer.println(
        `   ${v.name}${v.priceDelta ? ` (+${money(v.priceDelta, symbol)})` : ''}`
      );
    }
    for (const m of item.selectedModifiers || []) {
      printer.println(
        `   + ${m.name}${m.priceDelta ? ` (+${money(m.priceDelta, symbol)})` : ''}`
      );
    }
    printer.leftRight('', money(Number(item.price) * Number(item.quantity), symbol));
  }
  printer.newLine();

  printer.drawLine();
  printer.leftRight('Subtotal', money(tx.subtotal, symbol));
  if (Number(tx.discount) > 0) printer.leftRight('Discount', `-${money(tx.discount, symbol)}`);
  if (Number(tx.tax) > 0) printer.leftRight(settings?.tax || 'Tax', money(tx.tax, symbol));
  printer.bold(true);
  printer.leftRight('TOTAL', money(tx.total, symbol));
  printer.bold(false);
  if (tx.payment_breakdown && tx.payment_breakdown.length > 0) {
    for (const pb of tx.payment_breakdown) {
      printer.leftRight(pb.method, money(pb.amount, symbol));
    }
  } else {
    const paid = tx.paid != null ? Number(tx.paid) : Number(tx.total) + Number(tx.change || 0);
    printer.leftRight('Paid', money(paid, symbol));
  }
  printer.leftRight('Change', money(tx.change, symbol));
  printer.newLine();

  if (settings?.footer) {
    printer.drawLine();
    printer.alignCenter();
    printer.println(settings.footer);
    printer.alignLeft();
  }
  printer.newLine();
  printer.cut();
}

export function writeKot(printer, tx) {
  printer.bold(true);
  printer.alignCenter();
  printer.println('KITCHEN ORDER');
  printer.bold(false);
  printer.alignLeft();
  printer.drawLine();

  printer.bold(true);
  printer.println(`Order: ${tx.ref_number || tx.id}`);
  printer.bold(false);
  centered(printer, new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  printer.newLine();

  printer.drawLine();
  for (const item of tx.items || []) {
    printer.bold(true);
    printer.println(`${item.quantity}x ${item.name}`);
    printer.bold(false);
    if (item.note) printer.println(`   Note: ${item.note}`);
    for (const comp of item.components || []) {
      printer.println(`   - ${comp.name} x${comp.quantity}`);
    }
  }
  printer.newLine();
  printer.cut();
}

export async function printReceiptJob(tx, settings, config, { printKot = false } = {}) {
  const printer = makePrinter(config.receipt);
  if (!printer) return { printed: false, fallback: true, kotPrinted: false };
  try {
    writeReceipt(printer, tx, settings);
    await printer.execute();
  } catch (err) {
    console.error('Thermal receipt print failed:', err);
    return { printed: false, fallback: true, kotPrinted: false };
  }

  let kotPrinted = false;
  if (printKot && config.autoPrintKot && config.kot.interface) {
    const kotPrinter = makePrinter(config.kot);
    if (kotPrinter) {
      try {
        writeKot(kotPrinter, tx);
        await kotPrinter.execute();
        kotPrinted = true;
      } catch (err) {
        console.error('KOT print failed:', err);
      }
    }
  }
  return { printed: true, fallback: false, kotPrinted };
}

export async function printKotJob(tx, config) {
  const printer = makePrinter(config.kot);
  if (!printer) return { printed: false, fallback: true };
  try {
    writeKot(printer, tx);
    await printer.execute();
    return { printed: true, fallback: false };
  } catch (err) {
    console.error('KOT print failed:', err);
    return { printed: false, fallback: true };
  }
}
