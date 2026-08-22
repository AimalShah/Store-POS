import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getDbPath } from '../db.js';
import {
  asyncHandler,
  requireAdmin,
} from '../auth.js';

const router = Router();

function getBackupsDir() {
  const userData = path.join(process.env.APPDATA || process.env.HOME || '/tmp', 'POS');
  const backupsDir = path.join(userData, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  return backupsDir;
}

function generateBackupName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `pos-v3-${year}-${month}-${day}-${hour}-${minute}-${second}.sqlite`;
}

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const dbPath = getDbPath();
    if (!dbPath) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const backupsDir = getBackupsDir();
    const backupName = generateBackupName();
    const backupPath = path.join(backupsDir, backupName);

    fs.copyFileSync(dbPath, backupPath);

    const stats = fs.statSync(backupPath);
    res.json({
      ok: true,
      backup: {
        filename: backupName,
        path: backupPath,
        size: stats.size,
        createdAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const backupsDir = getBackupsDir();

    if (!fs.existsSync(backupsDir)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(backupsDir);
    const backups = files
      .filter((f) => f.endsWith('.sqlite'))
      .map((filename) => {
        const filePath = path.join(backupsDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          path: filePath,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ backups });
  })
);

router.post(
  '/restore',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { filename, confirm } = req.body || {};

    if (!confirm) {
      return res.status(400).json({ error: 'Confirmation required. Pass { confirm: true }' });
    }

    if (!filename) {
      return res.status(400).json({ error: 'Filename required' });
    }

    const dbPath = getDbPath();
    if (!dbPath) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    const safetyBackupName = `pos-v3-pre-restore-${Date.now()}.sqlite`;
    const safetyBackupPath = path.join(backupsDir, safetyBackupName);
    fs.copyFileSync(dbPath, safetyBackupPath);

    fs.copyFileSync(backupPath, dbPath);

    res.json({
      ok: true,
      message: 'Database restored successfully',
      safetyBackup: safetyBackupName,
    });
  })
);

export default router;