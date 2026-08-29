import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb, mapSettings, auditLog } from '../db.js';
import {
  asyncHandler,
  requireAdmin,
} from '../auth.js';
import logger from '../logger.js';

// Tables that hold business data. Everything here is wiped by the "Start as
// new" reset; configuration (settings, printer_settings) and accounts
// (users) always survive.
const RESET_TABLES = [
  'transactions',
  'shifts',
  'drawer_sessions',
  'stock_movements',
  'product_components',
  'product_sizes',
  'stock_entries',
  'products',
  'categories',
  'ingredients',
  'customers',
  'media_library',
  'audit_log',
];

// Same Windows-aware location the sqlite backup route uses: on Windows this
// resolves to %APPDATA%\POS\backups, elsewhere ~/POS/backups.
export function getResetBackupsDir() {
  const userData = process.env.APPDATA || process.env.HOME || os.homedir() || '/tmp';
  const dir = path.join(userData, 'POS', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function escapeCsvField(value) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function tableToCsv(db, table) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  const lines = [cols.map(escapeCsvField).join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsvField(row[c])).join(','));
  }
  return `\ufeff${lines.join('\r\n')}`;
}

export default function settingsRouter(uploadsPath) {
  const router = Router();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsPath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `logo-${crypto.randomUUID()}${ext}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image uploads are allowed'));
      }
      cb(null, true);
    },
  });

  router.get('/get', asyncHandler(async (_req, res) => {
    const row = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(mapSettings(row));
  }));

  router.post(
    '/post',
    requireAdmin,
    upload.single('imagename'),
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const db = getDb();
      const authUser = req.user || {};
      let image = body.img || '';

      if (req.file) {
        image = req.file.filename;
      }

      if (String(body.remove) === '1' && body.img) {
        const oldPath = path.join(uploadsPath, body.img);
        try {
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (err) {
          logger.error({ err: err.message }, 'Failed to delete old image');
        }
        if (!req.file) image = '';
      }

      const existing = db.prepare('SELECT * FROM settings WHERE id = 1').get();
      const payload = {
        app: 'Standalone Point of Sale',
        store: body.store ?? existing?.store ?? '',
        address_one: body.address_one ?? existing?.address_one ?? '',
        address_two: body.address_two ?? existing?.address_two ?? '',
        contact: body.contact ?? existing?.contact ?? '',
        tax: body.tax ?? existing?.tax ?? '',
        symbol: body.symbol ?? existing?.symbol ?? 'Rs',
        percentage: parseFloat(body.percentage ?? existing?.percentage ?? 0) || 0,
        charge_tax: body.charge_tax === 'on' || body.charge_tax === true || body.charge_tax === 1 || body.charge_tax === '1' ? 1 : 0,
        footer: body.footer ?? existing?.footer ?? '',
        img: image || existing?.img || '',
        till: parseInt(body.till ?? existing?.till ?? 1, 10) || 1,
      };

      db
        .prepare(
          `UPDATE settings SET
            app = ?, store = ?, address_one = ?, address_two = ?, contact = ?,
            tax = ?, symbol = ?, percentage = ?, charge_tax = ?, footer = ?,
            img = ?, till = ?
           WHERE id = 1`
        )
        .run(
          payload.app,
          payload.store,
          payload.address_one,
          payload.address_two,
          payload.contact,
          payload.tax,
          payload.symbol,
          payload.percentage,
          payload.charge_tax,
          payload.footer,
          payload.img,
          payload.till
        );

      const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
      auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'update', 'settings', 1, existing, row);
      res.json(mapSettings(row));
    })
  );

  router.post(
    '/reset',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { confirm } = req.body || {};
      if (confirm !== true) {
        return res.status(400).json({ error: 'Confirmation required. Pass { confirm: true }' });
      }

      const db = getDb();
      const authUser = req.user || {};

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resetDir = path.join(getResetBackupsDir(), `start-as-new-${stamp}`);
      fs.mkdirSync(resetDir, { recursive: true });

      const dumped = [];
      for (const table of RESET_TABLES) {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all();
        if (cols.length === 0) continue;
        const rows = db.prepare(`SELECT * FROM ${table}`).all();
        fs.writeFileSync(path.join(resetDir, `${table}.csv`), tableToCsv(db, table));
        dumped.push({ table, rows: rows.length });
      }

      const libraryDir = path.join(uploadsPath, 'library');
      if (fs.existsSync(libraryDir)) {
        for (const f of fs.readdirSync(libraryDir)) {
          fs.rmSync(path.join(libraryDir, f), { recursive: true, force: true });
        }
      }

      const wipe = db.transaction(() => {
        for (const table of RESET_TABLES) {
          db.prepare(`DELETE FROM ${table}`).run();
        }
        for (const table of RESET_TABLES) {
          db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
        }
        const walkIn = db.prepare("SELECT id FROM customers WHERE name = 'Walk-in Customer'").get();
        if (!walkIn) {
          db.prepare(
            "INSERT INTO customers (name, phone, email, address) VALUES ('Walk-in Customer', '', '', '')"
          ).run();
        }
      });
      wipe();

      auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'delete', 'settings', 1, { reset: true }, { reset: true, backupDir: resetDir, tables: dumped });
      res.json({
        ok: true,
        backupDir: resetDir,
        tables: dumped,
      });
    })
  );

  return router;
}
