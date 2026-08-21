import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb, mapSettings, auditLog } from '../db.js';
import { requirePerm, asyncHandler } from '../auth.js';
import logger from '../logger.js';

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
    requirePerm('perm_settings'),
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

  return router;
}
