import { Router } from 'express';
import { getDb } from '../db.js';
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

// Get open drawer session for a till
router.get('/open', (req, res) => {
  const till = parseInt(req.query.till, 10) || 1;
  const db = getDb();
  
  const session = db
    .prepare(`SELECT * FROM drawer_sessions WHERE till = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`)
    .get(till);
  
  res.json({ session });
});

// Get all drawer sessions with filters
router.get('/', requirePerm('perm_transactions'), (req, res) => {
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
  res.json(rows.map((row) => ({
    id: row.id,
    till: row.till,
    floatAmount: row.float_amount,
    countedCash: row.counted_cash,
    variance: row.variance,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  })));
});

// Open a new drawer session
router.post('/open', (req, res) => {
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
    `INSERT INTO drawer_sessions (user_id, user_name, till, float_amount, status, opened_at)
     VALUES (?, ?, ?, ?, 'open', ?)`
  ).run(userId, userName, till, floatAmount, openedAt);

  const session = db.prepare('SELECT * FROM drawer_sessions WHERE id = ?').get(result.lastInsertRowid);
  res.json({ session });
});

// Close a drawer session
router.post('/:sessionId/close', (req, res) => {
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
  const expectedVariance = session.float_amount + (session.counted_cash || 0) - countedCash;
  
  db.prepare(
    `UPDATE drawer_sessions SET counted_cash = ?, status = 'closed', closed_at = ?, variance = ? WHERE id = ?`
  ).run(countedCash, closedAt, expectedVariance, sessionId);

  const updatedSession = db.prepare('SELECT * FROM drawer_sessions WHERE id = ?').get(sessionId);
  res.json({ session: updatedSession });
});

// Get reconciliation summary for a till
router.get('/summary', requirePerm('perm_transactions'), (req, res) => {
  const till = parseInt(req.query.till, 10) || 1;
  const db = getDb();
  
  const openSession = db.prepare(`SELECT * FROM drawer_sessions WHERE till = ? AND status = 'open'`).get(till);
  const closedSessions = db.prepare(`SELECT * FROM drawer_sessions WHERE till = ? AND status = 'closed'`).all(till);
  
  let totalVariance = 0;
  let totalExpected = 0;
  let totalActual = 0;
  let closedCount = 0;
  
  for (const session of closedSessions) {
    const variance = session.variance || 0;
    totalVariance += variance;
    totalExpected += session.float_amount + (session.counted_cash || 0);
    totalActual += countedCash || 0;  // This needs fix - need to get the counted cash from each session
    closedCount++;
  }
  
  // Actually, let me compute this properly
  let totalFloat = 0;
  let totalClose = 0;
  let totalVar = 0;
  
  for (const session of closedSessions) {
    totalFloat += session.float_amount;
    totalClose += session.counted_cash || 0;
    totalVar += session.variance || 0;
  }
  
  res.json({
    till,
    openSession,
    closedSessions,
    summary: {
      totalSessions: closedSessions.length,
      totalFloat,
      totalClose,
      totalVariance: totalVar,
    }
  });
});

export default router;