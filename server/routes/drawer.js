import { Router } from 'express';
import { getDb } from '../db.js';
import {
  asyncHandler,
  requireManager,
  requireStaff,
} from '../auth.js';

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

// Get open drawer session for a till
router.get('/open', asyncHandler(async (req, res) => {
  const till = parseInt(req.query.till, 10) || 1;
  const db = getDb();
  
  const session = db
    .prepare(`SELECT * FROM drawer_sessions WHERE till = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`)
    .get(till);
  
  res.json({ session: mapSession(session) });
}));

// Get all drawer sessions with filters (Staff+)
router.get('/', requireStaff, asyncHandler(async (req, res) => {
  const db = getDb();
  const status = req.query.status;
  const till = parseInt(req.query.till, 10) || 0;

  let sql = `SELECT * FROM drawer_sessions WHERE 1=1`;
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (till) {
    sql += ' AND till = ?';
    params.push(till);
  }

  sql += ' ORDER BY opened_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapSession));
}));

// Open a new drawer session (Staff+)
router.post('/open', requireStaff, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const floatAmount = parseFloat(body.floatAmount) || 0;
  const till = parseInt(body.till, 10) || 1;
  const authUser = req.user || {};
  const userId = authUser.id || 0;
  const userName = authUser.fullname || 'Unknown';

  const db = getDb();
  
  // Check if there's already an open drawer for this till
  const existingOpen = db.prepare(`SELECT * FROM drawer_sessions WHERE till = ? AND status = 'open'`).get(till);
  if (existingOpen) {
    return res.status(400).json({ error: 'A drawer is already open for this till' });
  }

  const openedAt = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO drawer_sessions (user_id, user_name, till, float_amount, running_balance, status, opened_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  ).run(userId, userName, till, floatAmount, floatAmount, openedAt);

  const session = db.prepare('SELECT * FROM drawer_sessions WHERE id = ?').get(result.lastInsertRowid);
  res.json({ session: mapSession(session) });
}));

// Close a drawer session (Staff+)
router.post('/:sessionId/close', requireStaff, asyncHandler(async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const body = req.body || {};
  const countedCash = parseFloat(body.countedCash) || 0;

  const db = getDb();
  const session = db.prepare('SELECT * FROM drawer_sessions WHERE id = ?').get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Drawer session not found' });
  }
  if (session.status === 'closed') {
    return res.status(400).json({ error: 'Drawer is already closed' });
  }

  const closedAt = new Date().toISOString();
  const expectedVariance = session.running_balance - countedCash;
  
  db.prepare(
    `UPDATE drawer_sessions SET counted_cash = ?, status = 'closed', closed_at = ?, variance = ? WHERE id = ?`
  ).run(countedCash, closedAt, expectedVariance, sessionId);

  const updatedSession = db.prepare('SELECT * FROM drawer_sessions WHERE id = ?').get(sessionId);
  res.json({ session: mapSession(updatedSession) });
}));

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    till: row.till,
    floatAmount: row.float_amount,
    runningBalance: row.running_balance,
    countedCash: row.counted_cash,
    variance: row.variance,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    userId: row.user_id,
    userName: row.user_name,
  };
}

// Get reconciliation summary for a till
router.get('/summary', requireManager, asyncHandler(async (req, res) => {
  const till = parseInt(req.query.till, 10) || 1;
  const db = getDb();

  const openSession = db.prepare(`SELECT * FROM drawer_sessions WHERE till = ? AND status = 'open'`).get(till);
  const closedSessions = db.prepare(`SELECT * FROM drawer_sessions WHERE till = ? AND status = 'closed'`).all(till);

  let totalFloat = 0;
  let totalClose = 0;
  let totalVar = 0;

  for (const session of closedSessions) {
    totalFloat += session.float_amount;
    totalClose += session.counted_cash || 0;
    totalVar += session.variance || 0;
  }

  // The running balance is updated in the same transaction that completes a
  // Sale, so this read remains correct even after historical records change.
  let live = null;
  if (openSession) {
    const expectedCash = Number(openSession.running_balance) || 0;
    live = {
      cashSales: expectedCash - (Number(openSession.float_amount) || 0),
      expectedCash,
    };
  }

  res.json({
    till,
    openSession: mapSession(openSession),
    closedSessions: closedSessions.map(mapSession),
    live,
    summary: {
      totalSessions: closedSessions.length,
      totalFloat,
      totalClose,
      totalVariance: totalVar,
    }
  });
}));

export default router;
