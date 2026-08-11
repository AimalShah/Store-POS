import { Router } from 'express';
import { getDb, mapTransaction } from '../db.js';
import { requirePerm } from '../auth.js';

const router = Router();

function decrementInventory(items, db, transactionId, userId, userName) {
  for (const item of items || []) {
    const id = parseInt(item.id ?? item._id, 10);
    const qty = parseInt(item.quantity, 10) || 0;
    if (!id || !qty) continue;
    const product = db.prepare('SELECT id, quantity, stock FROM products WHERE id = ?').get(id);
    if (!product || product.stock === 0) continue;
    const updated = Math.max(0, (product.quantity || 0) - qty);
    db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(updated, id);

    // Log stock movement for sale
    db.prepare(
      `INSERT INTO stock_movements (product_id, type, quantity_change, quantity_after, reason, reference_id, reference_type, user_id, user_name, created_at)
       VALUES (?, 'sale', ?, ?, 'Sale deduction', ?, 'transaction', ?, ?, ?)`
    ).run(id, -qty, updated, transactionId, userId, userName, new Date().toISOString());
  }
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Transactions store UTC ISO dates; the store's day boundary is local time,
// so the daily invoice counter runs against the sale's local day.
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

function nextInvoiceNumber(db, iso) {
  const { startIso, endIso } = localDayRange(iso);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM transactions
       WHERE status = 1 AND date >= ? AND date <= ?`
    )
    .get(startIso, endIso);
  return `INV-${localDay(iso)}-${String((row.n || 0) + 1).padStart(3, '0')}`;
}

router.get('/all', requirePerm('perm_transactions'), (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM transactions ORDER BY date DESC').all();
  res.json(rows.map(mapTransaction));
});

router.get('/on-hold', (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT * FROM transactions
       WHERE ref_number != '' AND status = 0
       ORDER BY date DESC`
    )
    .all();
  res.json(rows.map(mapTransaction));
});

router.get('/customer-orders', (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT * FROM transactions
       WHERE customer != '0' AND status = 0 AND (ref_number IS NULL OR ref_number = '')
       ORDER BY date DESC`
    )
    .all();
  res.json(rows.map(mapTransaction));
});

router.get('/by-date', requirePerm('perm_transactions'), (req, res) => {
  const startDate = new Date(String(req.query.start || ''));
  const endDate = new Date(String(req.query.end || ''));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'Invalid start or end date' });
  }

  const start = startDate.toISOString();
  const end = endDate.toISOString();
  const statusRaw = parseInt(String(req.query.status), 10);
  const status = Number.isFinite(statusRaw) ? statusRaw : 1;
  const userId = parseInt(String(req.query.user), 10) || 0;
  const till = parseInt(String(req.query.till), 10) || 0;

  let sql = `SELECT * FROM transactions WHERE date >= ? AND date <= ? AND status = ?`;
  const params = [start, end, status];

  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  if (till) {
    sql += ' AND till = ?';
    params.push(till);
  }
  sql += ' ORDER BY date DESC';

  const rows = getDb().prepare(sql).all(...params);
  res.json(rows.map(mapTransaction));
});

router.post('/new', (req, res) => {
  const body = req.body || {};
  const items = body.items || [];
  const paid = parseFloat(body.paid) || 0;
  const total = parseFloat(body.total) || 0;
  const saleDate = body.date || new Date().toISOString();

  const db = getDb();
  let invoiceRef = '';
  const insert = db.transaction(() => {
    const status = parseInt(body.status, 10) ?? 1;
    const isPaid = status === 1 && paid >= total;
    let ref = body.ref_number || '';
    if (isPaid && !ref) {
      ref = nextInvoiceNumber(db, saleDate);
    }
    invoiceRef = ref;

    const paymentBreakdown = body.payment_breakdown || [];
    const result = db
      .prepare(
        `INSERT INTO transactions (
          ref_number, customer, customer_name, status, user_id, user_name, till,
          discount, subtotal, tax, total, paid, change, payment_type, payment_breakdown_json, items_json, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ref,
        String(body.customer ?? '0'),
        body.customer_name || '',
        status,
        parseInt(body.user_id, 10) || 0,
        body.user || body.user_name || '',
        parseInt(body.till, 10) || 1,
        parseFloat(body.discount) || 0,
        parseFloat(body.subtotal) || 0,
        parseFloat(body.tax) || 0,
        total,
        paid,
        parseFloat(body.change) || 0,
        parseInt(body.payment_type, 10) || 1,
        JSON.stringify(paymentBreakdown),
        JSON.stringify(items),
        saleDate
      );

    if (isPaid) {
      decrementInventory(items, db, result.lastInsertRowid, parseInt(body.user_id, 10) || 0, body.user || body.user_name || '');
    }

    return result.lastInsertRowid;
  });

  const id = insert();
  res.json({ ok: true, id, ref_number: invoiceRef });
});

router.put('/new/:id', (req, res) => {
  const body = req.body || {};
  const id = parseInt(req.params.id ?? body._id ?? body.id, 10);
  const items = body.items || [];
  const paymentBreakdown = body.payment_breakdown || [];
  const paid = parseFloat(body.paid) || 0;
  const total = parseFloat(body.total) || 0;
  const status = parseInt(body.status, 10) ?? 1;
  const saleDate = body.date || new Date().toISOString();

  const db = getDb();
  let invoiceRef = '';
  const update = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    const transitionToPaid = existing?.status === 0 && status === 1 && paid >= total;

    let ref = body.ref_number ?? existing?.ref_number ?? '';
    if (transitionToPaid && (!ref || ref.startsWith('H-'))) {
      ref = nextInvoiceNumber(db, saleDate);
    }
    invoiceRef = ref;

    db.prepare(
      `UPDATE transactions SET
        ref_number = ?, customer = ?, customer_name = ?, status = ?, user_id = ?, user_name = ?, till = ?,
        discount = ?, subtotal = ?, tax = ?, total = ?, paid = ?, change = ?, payment_type = ?, payment_breakdown_json = ?, items_json = ?, date = ?
       WHERE id = ?`
    ).run(
      ref,
      String(body.customer ?? '0'),
      body.customer_name || '',
      status,
      parseInt(body.user_id, 10) || 0,
      body.user || body.user_name || '',
      parseInt(body.till, 10) || 1,
      parseFloat(body.discount) || 0,
      parseFloat(body.subtotal) || 0,
      parseFloat(body.tax) || 0,
      total,
      paid,
      parseFloat(body.change) || 0,
      parseInt(body.payment_type, 10) || 1,
      JSON.stringify(paymentBreakdown),
      JSON.stringify(items),
      saleDate,
      id
    );

    // Decrement stock when completing a previously unpaid/hold order
    if (transitionToPaid) {
      decrementInventory(items, db, id, parseInt(body.user_id, 10) || 0, body.user || body.user_name || '');
    }
  });

  update();
  res.json({ ok: true, id, ref_number: invoiceRef });
});

router.post('/delete', (req, res) => {
  const orderId = parseInt(req.body?.orderId ?? req.body?._id, 10);
  getDb().prepare('DELETE FROM transactions WHERE id = ?').run(orderId);
  res.sendStatus(200);
});

router.get('/transaction/:transactionId', (req, res) => {
  const row = getDb()
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(parseInt(req.params.transactionId, 10));
  res.json(mapTransaction(row));
});

export default router;
