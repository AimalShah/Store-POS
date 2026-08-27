import { createRequire } from 'module';
import { printer as ThermalPrinter, types } from 'node-thermal-printer';
import { getDb } from '../server/db.js';
import { PrinterManager } from './printer/PrinterManager.js';

const require = createRequire(import.meta.url);

/**
 * Lazy-load the printer driver.
 * In a real Windows environment, this will now use the 'printer' N-API module.
 */
function getNativeDriver() {
  if (process.platform !== 'win32') return null;
  try {
    // Try the modern 'printer' module first
    return require('printer');
  } catch (err) {
    console.error('Modern printer driver unavailable, falling back:', err);
    try {
      // Fallback to legacy
      return require('@thiagoelg/node-printer');
    } catch (e) {
      console.error('No printer driver module found.');
      return null;
    }
  }
}

const printerManager = new PrinterManager(getNativeDriver());

const THERMAL_NAME_HINTS = [
  'pos', 'thermal', 'receipt', 'tm-', 'tm ', 'epson tm', 'star', 'xprinter',
  'xp-', 'zjiang', 'gprinter', 'rongta', 'citizen', 'bixolon', 'sewoo',
  '58mm', '80mm', 'ticket', 'kot',
];

export function isLikelyThermalPrinterName(name) {
  const n = String(name || '').toLowerCase();
  return THERMAL_NAME_HINTS.some((hint) => n.includes(hint));
}

export function listSystemPrinters() {
  return printerManager.getPrinters().map(p => ({
      ...p,
      likelyThermal: isLikelyThermalPrinterName(p.name),
  }));
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

// ... (rest of the file remains as previously written, ensuring functions like interfaceUri and makePrinter are present)

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
  if (!uri) return null;
  const options = {
    type: types.EPSON,
    interface: uri,
    width: conf.width === 80 ? 48 : 32,
    lineCharacter: '=',
  };
  if (conf.interface === 'usb' && process.platform === 'win32') {
    // If we're on Windows, we inject the printerManager's driver instance
    options.driver = getNativeDriver();
  }
  return new ThermalPrinter(options);
}
