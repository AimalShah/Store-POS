import { Router } from 'express';
import { getDb, mapPrinterSettings } from '../db.js';
import { requirePerm } from '../auth.js';

const router = Router();

const toPort = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const toWidth = (value, fallback) => (parseInt(value, 10) === 80 ? 80 : fallback === 80 ? 80 : 58);

router.get('/settings', (_req, res) => {
  const row = getDb().prepare('SELECT * FROM printer_settings WHERE id = 1').get();
  res.json({ printer: mapPrinterSettings(row) });
});

router.post('/settings', requirePerm('perm_settings'), (req, res) => {
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
});

export default router;
