import { Router } from 'express';
import { getDb, mapCustomer, auditLog } from '../db.js';
import {
  asyncHandler,
  requireManager,
  requireStaff,
} from '../auth.js';

const router = Router();

router.get('/all', asyncHandler(async (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM customers ORDER BY name').all();
  res.json(rows.map(mapCustomer));
}));

router.get('/customer/:customerId', asyncHandler(async (req, res) => {
  const row = getDb()
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(parseInt(req.params.customerId, 10));
  res.json(mapCustomer(row));
}));

router.post('/customer', requireStaff, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const authUser = req.user || {};
  const result = db
    .prepare(
      `INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)`
    )
    .run(body.name || '', body.phone || '', body.email || '', body.address || '');
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'create', 'customer', row.id, null, row);
  res.sendStatus(200);
}));

router.put('/customer', requireManager, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const id = parseInt(body._id ?? body.id, 10);
  const db = getDb();
  const authUser = req.user || {};
  const oldRow = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  db
    .prepare(
      `UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?`
    )
    .run(body.name || '', body.phone || '', body.email || '', body.address || '', id);
  const newRow = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'update', 'customer', id, oldRow, newRow);
  res.sendStatus(200);
}));

router.delete('/customer/:customerId', requireManager, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.customerId, 10);
  const db = getDb();
  const authUser = req.user || {};
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (row) {
    auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'delete', 'customer', id, row, null);
  }
  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  res.sendStatus(200);
}));

export default router;
