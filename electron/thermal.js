import { characterSet, printer as ThermalPrinter, types } from 'node-thermal-printer';
import { getDb } from '../server/db.js';
import { PrinterManager } from './printer/PrinterManager.js';
import { winSpoolDriver } from './printer/WinSpoolDriver.js';
import logger from '../server/logger.js';

const printerManager = new PrinterManager(process.platform === 'win32' ? winSpoolDriver : null);
const DEBUG_TAG = '[PRINTER-DEBUG-7f3c]';

const THERMAL_NAME_HINTS = [
  'pos', 'thermal', 'receipt', 'tm-', 'tm ', 'epson tm', 'star', 'xprinter',
  'xp-', 'zjiang', 'gprinter', 'rongta', 'citizen', 'bixolon', 'sewoo',
  '58mm', '80mm', 'ticket', 'kot', 'speedx', 'pos-80', 'pos80',
];

export function isLikelyThermalPrinterName(name) {
  const n = String(name || '').toLowerCase();
  return THERMAL_NAME_HINTS.some((hint) => n.includes(hint));
}

export function listSystemPrinters() {
  const printers = printerManager.getPrinters().map(p => ({
      ...p,
      likelyThermal: isLikelyThermalPrinterName(p.name),
  }));

  console.log(printerManager.getPrinters());

  logger.info({ count: printers.length, printers }, `${DEBUG_TAG} System printers listed`);
  return printers;
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
  if (conf.interface === 'network') {
    return conf.networkHost ? `tcp://${conf.networkHost}:${conf.networkPort || 9100}` : '';
  }
  if (conf.interface === 'usb') {
    if (!conf.usbDevice) return '';
    if (process.platform === 'win32') return `printer:${conf.usbDevice}`;
    return conf.usbDevice;
  }
  return '';
}

export function makePrinter(conf) {
  const uri = interfaceUri(conf);
  if (!uri) {
    logger.warn({ interface: conf?.interface || '', hasUsbDevice: !!conf?.usbDevice, hasNetworkHost: !!conf?.networkHost },
      `${DEBUG_TAG} Printer configuration has no usable interface URI`);
    return null;
  }
  const options = {
    type: types.EPSON,
    interface: uri,
    width: conf.width === 80 ? 48 : 32,
    lineCharacter: '=',
    characterSet: 'PC47_USA',
  };
  if (conf.interface === 'usb' && process.platform === 'win32') {
    options.driver = winSpoolDriver;
  }
  logger.info({ interface: conf.interface, uri, width: options.width, usesWindowsSpooler: !!options.driver },
    `${DEBUG_TAG} Thermal printer client created`);
  return new ThermalPrinter(options);
}

function money(n, symbol) {
  return `${symbol}${Number(n || 0).toFixed(2)}`;
}

function cap(value) {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

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
  const startedAt = Date.now();
  logger.info({ order: tx.ref_number || tx.id, itemCount: tx.items?.length || 0, receipt: config.receipt, printKot },
    `${DEBUG_TAG} Receipt print requested`);
  const printer = makePrinter(config.receipt);
  if (!printer) {
    logger.warn({ order: tx.ref_number || tx.id }, `${DEBUG_TAG} Receipt falling back because no printer was created`);
    return { printed: false, fallback: true, kotPrinted: false };
  }
  try {
    writeReceipt(printer, tx, settings);
    logger.debug({ order: tx.ref_number || tx.id }, `${DEBUG_TAG} Receipt ESC/POS content generated`);
    await printer.execute();
  } catch (err) {
    logger.error({ order: tx.ref_number || tx.id, err: { message: err.message, stack: err.stack } },
      `${DEBUG_TAG} Thermal receipt print failed`);
    return { printed: false, fallback: true, kotPrinted: false };
  }
  logger.info({ order: tx.ref_number || tx.id, durationMs: Date.now() - startedAt },
    `${DEBUG_TAG} Receipt print completed`);
  let kotPrinted = false;
  if (printKot && config.autoPrintKot && config.kot.interface) {
    const kotPrinter = makePrinter(config.kot);
    if (kotPrinter) {
      try {
        writeKot(kotPrinter, tx);
        logger.debug({ order: tx.ref_number || tx.id }, `${DEBUG_TAG} Kitchen ticket ESC/POS content generated`);
        await kotPrinter.execute();
        kotPrinted = true;
      } catch (err) {
        logger.error({ order: tx.ref_number || tx.id, err: { message: err.message, stack: err.stack } },
          `${DEBUG_TAG} Kitchen ticket print failed`);
      }
    }
  }
  return { printed: true, fallback: false, kotPrinted };
}

export async function printKotJob(tx, config) {
  const startedAt = Date.now();
  logger.info({ order: tx.ref_number || tx.id, itemCount: tx.items?.length || 0, kot: config.kot },
    `${DEBUG_TAG} Kitchen ticket print requested`);
  const printer = makePrinter(config.kot);
  if (!printer) {
    logger.warn({ order: tx.ref_number || tx.id }, `${DEBUG_TAG} Kitchen ticket falling back because no printer was created`);
    return { printed: false, fallback: true };
  }
  try {
    writeKot(printer, tx);
    logger.debug({ order: tx.ref_number || tx.id }, `${DEBUG_TAG} Kitchen ticket ESC/POS content generated`);
    await printer.execute();
    logger.info({ order: tx.ref_number || tx.id, durationMs: Date.now() - startedAt },
      `${DEBUG_TAG} Kitchen ticket print completed`);
    return { printed: true, fallback: false };
  } catch (err) {
    logger.error({ order: tx.ref_number || tx.id, err: { message: err.message, stack: err.stack } },
      `${DEBUG_TAG} Kitchen ticket print failed`);
    return { printed: false, fallback: true };
  }
}
