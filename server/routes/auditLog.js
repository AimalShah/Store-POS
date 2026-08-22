import { Router } from 'express';
import { getDb, mapAuditLog } from '../db.js';
import {
  asyncHandler,
  requireAdmin,
} from '../auth.js';

const router = Router();

router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDb();
  const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
  const entityType = req.query.entityType;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  const limit = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;

  let sql = `SELECT * FROM audit_log WHERE 1=1`;
  const params = [];

  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  if (entityType) {
    sql += ' AND entity_type = ?';
    params.push(entityType);
  }
  if (startDate) {
    sql += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND created_at <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);

  let countSql = `SELECT COUNT(*) as n FROM audit_log WHERE 1=1`;
  const countParams = [];
  if (userId) {
    countSql += ' AND user_id = ?';
    countParams.push(userId);
  }
  if (entityType) {
    countSql += ' AND entity_type = ?';
    countParams.push(entityType);
  }
  if (startDate) {
    countSql += ' AND created_at >= ?';
    countParams.push(startDate);
  }
  if (endDate) {
    countSql += ' AND created_at <= ?';
    countParams.push(endDate);
  }

  const total = db.prepare(countSql).get(...countParams);

  res.json({ logs: rows.map(mapAuditLog), total: total?.n || 0 });
}));

export default router;