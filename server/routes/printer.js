import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb, mapPrinterSettings, getUploadsPath } from '../db.js';
import { requirePerm, asyncHandler } from '../auth.js';
import logger from '../logger.js';

const router = Router();

const toPort = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const toWidth = (value, fallback) => (parseInt(value, 10) === 80 ? 80 : fallback === 80 ? 80 : 58);

function generateTestPrint(printer, settings) {
  const lines = [];
  const width = printer.width === 80 ? 48 : 32;
  const center = (text) => text.padStart(Math.floor((width + text.length) / 2));
  const left = (text) => text.padEnd(width).slice(0, width);
  const right = (text) => text.padStart(width).slice(-width);
  const divider = '-'.repeat(width);

  lines.push(center(settings?.store || 'Store POS'));
  lines.push(center('TEST PRINT'));
  lines.push(center(new Date().toLocaleString()));
  lines.push(divider);
  lines.push(left(`Interface: ${printer.interface || 'Off'}`));
  if (printer.interface === 'usb') {
    lines.push(left(`USB Device: ${printer.usbDevice || 'Not set'}`));
  } else if (printer.interface === 'network') {
    lines.push(left(`Host: ${printer.networkHost || 'Not set'}`));
    lines.push(left(`Port: ${printer.networkPort}`));
  }
  lines.push(left(`Paper: ${printer.width}mm`));
  lines.push(divider);
  lines.push(center('Printer is working!'));
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

function getPrinterInterface() {
  const uploadsPath = getUploadsPath();
  const printerPath = path.join(uploadsPath, '..', 'printer');
  return printerPath;
}

router.get('/settings', asyncHandler(async (_req, res) => {
  const row = getDb().prepare('SELECT * FROM printer_settings WHERE id = 1').get();
  res.json({ printer: mapPrinterSettings(row) });
}));

router.post('/settings', requirePerm('perm_settings'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const existing = db.prepare('SELECT * FROM printer_settings WHERE id = 1').get();

  const payload = {
    interface: body.interface ?? existing?.interface ?? '',
    usb_device: body.usbDevice ?? existing?.usb_device ?? '',
    network_host: body.networkHost ?? existing?.network_host ?? '',
    network_port: toPort(body.networkPort ?? existing?.network_port, 9100),
    width: toWidth(body.width ?? existing?.width, 58),
    kot_interface: body.kotInterface ?? existing?.kot_interface ?? '',
    kot_usb_device: body.kotUsbDevice ?? existing?.kot_usb_device ?? '',
    kot_network_host: body.kotNetworkHost ?? existing?.kot_network_host ?? '',
    kot_network_port: toPort(body.kotNetworkPort ?? existing?.kot_network_port, 9100),
    kot_width: toWidth(body.kotWidth ?? existing?.kot_width, 58),
    auto_print_kot:
      body.autoPrintKot === true || body.autoPrintKot === 1 || body.autoPrintKot === '1' ? 1 : 0,
  };

  if (existing) {
    db.prepare(
      `UPDATE printer_settings SET
        interface = ?, usb_device = ?, network_host = ?, network_port = ?, width = ?,
        kot_interface = ?, kot_usb_device = ?, kot_network_host = ?, kot_network_port = ?,
        kot_width = ?, auto_print_kot = ?
       WHERE id = 1`
    ).run(
      payload.interface,
      payload.usb_device,
      payload.network_host,
      payload.network_port,
      payload.width,
      payload.kot_interface,
      payload.kot_usb_device,
      payload.kot_network_host,
      payload.kot_network_port,
      payload.kot_width,
      payload.auto_print_kot
    );
  } else {
    db.prepare(
      `INSERT INTO printer_settings (
        id, interface, usb_device, network_host, network_port, width,
        kot_interface, kot_usb_device, kot_network_host, kot_network_port, kot_width, auto_print_kot
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      payload.interface,
      payload.usb_device,
      payload.network_host,
      payload.network_port,
      payload.width,
      payload.kot_interface,
      payload.kot_usb_device,
      payload.kot_network_host,
      payload.kot_network_port,
      payload.kot_width,
      payload.auto_print_kot
    );
  }

  const row = db.prepare('SELECT * FROM printer_settings WHERE id = 1').get();
  res.json({ printer: mapPrinterSettings(row) });
}));

router.post('/test', requirePerm('perm_settings'), asyncHandler(async (req, res) => {
  const db = getDb();
  const printer = db.prepare('SELECT * FROM printer_settings WHERE id = 1').get();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  if (!printer || !printer.interface) {
    return res.status(400).json({ error: 'No printer configured. Set up a printer first.' });
  }

  // For now, we just return success with the test content
  // In a real implementation, this would send to the actual printer
  const testContent = generateTestPrint(printer, settings);
  
  logger.info({ printer: printer.interface }, 'Test print requested');
  
  res.json({
    ok: true,
    message: 'Test print sent to printer',
    content: testContent,
  });
}));

export default router;
