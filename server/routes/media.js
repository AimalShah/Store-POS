import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db.js';
import {
  asyncHandler,
  requireManager,
} from '../auth.js';
import logger from '../logger.js';

function mapMedia(row) {
  return {
    id: row.id,
    filename: row.filename,
    path: `library/${row.filename}`,
    source: row.source,
    photographer: row.photographer,
    alt: row.alt,
    created_at: row.created_at,
  };
}

export default function mediaRouter(uploadsPath) {
  const libraryDir = path.join(uploadsPath, 'library');
  fs.mkdirSync(libraryDir, { recursive: true });

  const router = Router();
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, libraryDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
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

  router.get('/library', asyncHandler(async (_req, res) => {
    const rows = getDb()
      .prepare('SELECT * FROM media_library ORDER BY id DESC')
      .all();
    res.json(rows.map(mapMedia));
  }));

  router.post('/upload', requireManager, upload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    const result = getDb()
      .prepare(
        `INSERT INTO media_library (filename, source, photographer, alt, created_at)
         VALUES (?, 'upload', '', ?, ?)`
      )
      .run(req.file.filename, req.body?.alt || '', new Date().toISOString());
    const row = getDb()
      .prepare('SELECT * FROM media_library WHERE id = ?')
      .get(result.lastInsertRowid);
    res.json(mapMedia(row));
  }));

  router.delete('/library/:id', requireManager, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const row = getDb().prepare('SELECT * FROM media_library WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    getDb().prepare('DELETE FROM media_library WHERE id = ?').run(id);
    const filePath = path.join(libraryDir, row.filename);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to delete media file');
    }
    res.sendStatus(200);
  }));

  return router;
}
