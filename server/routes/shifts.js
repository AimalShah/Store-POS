import { Router } from 'express';
import { getDb, mapShift, mapTransaction } from '../db.js';
import { requirePerm } from '../auth.js';

const router = Router();

function pad2(n) {
  return String(n).padStart(2, '0');
}

function localDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function localDayRange(iso) {
  const d = new Date(iso);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function computeXReport(db, shiftId, shiftOpenedAt) {
  const shiftOpen = new Date(shiftOpenedAt);
  const now = new Date();
  
  const sales = db.prepare(
    `SELECT * FROM transactions WHERE shift_id = ? AND status = 1`
  ).all(shiftId);

  let totalSales = 0;
  let cashSales = 0;
  let cardSales = 0;
  let mobileSales = 0;
  let saleCount = 0;
  let transactionCount = 0;
  let refundCount = 0;
  let refundTotal = 0;

  for (const sale of sales) {
    const paymentBreakdown = JSON.parse(sale.payment_breakdown_json || '[]');
    for (const pb of paymentBreakdown) {
      if (pb.method === 'cash') cashSales += pb.amount;
      else if (pb.method === 'card') cardSales += pb.amount;
      else if (pb.method === 'mobile') mobileSales += pb.amount;
    }
    totalSales += sale.total;
    saleCount++;
    transactionCount++;
  }

  const refunds = db.prepare(
    `SELECT * FROM transactions WHERE shift_id = ? AND status = 2`
  ).all(shiftId);

  for (const refund of refunds) {
    refundTotal += refund.total;
    refundCount++;
  }

  return {
    totalSales,
    cashSales,
    cardSales,
    mobileSales,
    saleCount,
    transactionCount,
    refundCount,
    refundTotal,
  };
}

function computeZReport(db, shiftId, shiftOpenedAt, floatAmount, countedCash) {
  const xReport = computeXReport(db, shiftId, shiftOpenedAt);
  const expectedCash = floatAmount + xReport.cashSales;
  const actualCash = countedCash || 0;
  const difference = actualCash - expectedCash;

  return {
    ...xReport,
    expectedCash,
    actualCash,
    difference,
  };
}

// Get open shift for a till
router.get('/open', (req, res) => {
  const till = parseInt(req.query.till, 10) || 1;
  const db = getDb();
  
  const shift = db
    .prepare(`SELECT * FROM shifts WHERE till = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`)
    .get(till);
  
  res.json(mapShift(shift));
});

// Get all shifts with filters
router.get('/', requirePerm('perm_transactions'), (req, res) => {
  const db = getDb();
  const status = req.query.status;
  const till = parseInt(req.query.till, 10) || 0;
  const userId = parseInt(req.query.userId, 10) || 0;
  const limit = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;

  let sql = `SELECT * FROM shifts WHERE 1=1`;
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (till) {
    sql += ' AND till = ?';
    params.push(till);
  }
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }

  sql += ' ORDER BY opened_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapShift));
});

// Open a new shift
router.post('/open', (req, res) => {
  const body = req.body || {};
  const floatAmount = parseFloat(body.floatAmount) || 0;
  const till = parseInt(body.till, 10) || 1;
  const user = req.user || { id: 0, fullname: 'Unknown' };

  // Check if there's already an open shift for this till
  const db = getDb();
  const existingOpen = db.prepare(`SELECT * FROM shifts WHERE till = ? AND status = 'open'`).get(till);
  if (existingOpen) {
    return res.status(400).json({ error: 'A shift is already open for this till' });
  }

  const openedAt = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO shifts (user_id, user_name, till, float_amount, status, opened_at)
     VALUES (?, ?, ?, ?, 'open', ?)`
  ).run(user.id, user.fullname, till, floatAmount, openedAt);

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(result.lastInsertRowid);
  res.json(mapShift(shift));
});

// Close a shift
router.post('/:shiftId/close', (req, res) => {
  const shiftId = parseInt(req.params.shiftId, 10);
  const body = req.body || {};
  const countedCash = parseFloat(body.countedCash) || 0;

  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }
  if (shift.status === 'closed') {
    return res.status(400).json({ error: 'Shift is already closed' });
  }

  const closedAt = new Date().toISOString();
  const xReport = computeXReport(db, shiftId, shift.opened_at);
  const zReport = computeZReport(db, shiftId, shift.opened_at, shift.float_amount, countedCash);

  db.prepare(
    `UPDATE shifts SET counted_cash = ?, status = 'closed', closed_at = ?, x_report_json = ?, z_report_json = ?
     WHERE id = ?`
  ).run(countedCash, closedAt, JSON.stringify(xReport), JSON.stringify(zReport), shiftId);

  const updatedShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  res.json(mapShift(updatedShift));
});

// Get X report for a shift
router.get('/:shiftId/x-report', requirePerm('perm_transactions'), (req, res) => {
  const shiftId = parseInt(req.params.shiftId, 10);
  const db = getDb();

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }

  const xReport = computeXReport(db, shiftId, shift.opened_at);
  res.json(xReport);
});

// Get Z report for a shift
router.get('/:shiftId/z-report', requirePerm('perm_transactions'), (req, res) => {
  const shiftId = parseInt(req.params.shiftId, 10);
  const db = getDb();

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }

  const zReport = computeZReport(db, shiftId, shift.opened_at, shift.float_amount, shift.counted_cash);
  res.json(zReport);
});

// Get transactions for a shift
router.get('/:shiftId/transactions', requirePerm('perm_transactions'), (req, res) => {
  const shiftId = parseInt(req.params.shiftId, 10);
  const db = getDb();

  const rows = db.prepare('SELECT * FROM transactions WHERE shift_id = ? ORDER BY date DESC').all(shiftId);
  res.json(rows.map(mapTransaction));
});

export default router;