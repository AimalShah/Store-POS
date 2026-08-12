import { printer as ThermalPrinter, types } from 'node-thermal-printer';
import { getDb } from '../server/db.js';

// Thermal printing runs in the Electron main process (Node), where it can
// talk to USB device files and the network. The renderer never prints
// directly; it asks via IPC and falls back to PDF/browser when unconfigured.

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

export function interfaceUri(conf) {
  if (conf.interface === 'network') {
    return conf.networkHost ? `tcp://${conf.networkHost}:${conf.networkPort || 9100}` : '';
  }
  if (conf.interface === 'usb') return conf.usbDevice || '';
  return '';
}

export function makePrinter(conf) {
  const uri = interfaceUri(conf);
  if (!uri) return null;
  return new ThermalPrinter({
    type: types.EPSON,
    interface: uri,
    width: conf.width === 80 ? 48 : 32,
    lineCharacter: '=',
  });
}

function money(n, symbol) {
  return `${symbol}${Number(n || 0).toFixed(2)}`;
}

function centered(printer, text) {
  printer.alignCenter();
  printer.println(text);
  printer.alignLeft();
}

export function writeReceipt(printer, tx, settings) {
  const symbol = settings?.symbol || 'Rs';

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
  printer.println(`INVOICE ${(tx.ref_number || '').trim()}`);
  printer.bold(false);
  printer.alignLeft();
  centered(printer, new Date(tx.date).toLocaleString());
  centered(printer, `Cashier: ${tx.user || '-'}   Till: ${tx.till || 1}`);
  centered(printer, `Customer: ${tx.customer_name || 'Walk-in'}`);
  printer.newLine();

  printer.drawLine();
  for (const item of tx.items || []) {
    printer.println(`${item.quantity}x ${item.name}`);
    if (item.note) printer.println(`   ${item.note}`);
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
  for (const pb of tx.payment_breakdown || []) {
    printer.leftRight(pb.method, money(pb.amount, symbol));
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
