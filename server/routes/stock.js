import { Router } from 'express';
import { getDb, auditLog } from '../db.js';
import { asyncHandler, requireManager } from '../auth.js';

const router = Router();

export const UNITS = ['pcs', 'kg', 'g', 'L', 'ml'];

function mapIngredient(row) {
  if (!row) return null;
  const balance = Number(row.balance) || 0;
  const costPerUnit = Number(row.cost_per_unit) || 0;
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    balance,
    costPerUnit,
    value: Math.round(balance * costPerUnit * 100) / 100,
    entryCount: row.entry_count || 0,
    lastEntry: row.last_type
      ? {
          type: row.last_type,
          quantity: Number(row.last_quantity) || 0,
          note: row.last_note || '',
          userName: row.last_user_name || '',
          createdAt: row.last_created_at,
        }
      : null,
  };
}

// Balance = Σ restocks − Σ usage − Σ wastage. One source of truth for every surface.
const BALANCE_SELECT = `
  SELECT i.*,
    COALESCE(SUM(CASE
      WHEN e.type = 'restock' THEN e.quantity
      ELSE -e.quantity
    END), 0) AS balance,
    COUNT(e.id) AS entry_count,
    (SELECT type FROM stock_entries WHERE ingredient_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_type,
    (SELECT quantity FROM stock_entries WHERE ingredient_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_quantity,
    (SELECT note FROM stock_entries WHERE ingredient_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_note,
    (SELECT user_name FROM stock_entries WHERE ingredient_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_user_name,
    (SELECT created_at FROM stock_entries WHERE ingredient_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_created_at
  FROM ingredients i
  LEFT JOIN stock_entries e ON e.ingredient_id = i.id
`;

router.get('/ingredients', requireManager, asyncHandler(async (_req, res) => {
  const rows = getDb()
    .prepare(`${BALANCE_SELECT} GROUP BY i.id ORDER BY i.name`)
    .all();
  res.json(rows.map(mapIngredient));
}));

router.post('/ingredients', requireManager, asyncHandler(async (req, res) => {
  const { name, unit, costPerUnit } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Name is required' });
  if (!UNITS.includes(unit)) {
    return res.status(400).json({ error: `Unit must be one of: ${UNITS.join(', ')}` });
  }
  const perUnit = Number(costPerUnit) || 0;
  if (perUnit < 0) return res.status(400).json({ error: 'Price cannot be negative' });
  const db = getDb();
  try {
    const result = db
      .prepare('INSERT INTO ingredients (name, unit, cost_per_unit) VALUES (?, ?, ?)')
      .run(trimmed, unit, perUnit);
    const row = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(result.lastInsertRowid);
    const authUser = req.user || {};
    auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'create', 'ingredient', row.id, null, row);
    res.json({ id: row.id, name: row.name, unit: row.unit, costPerUnit: perUnit, value: 0, balance: 0, entryCount: 0, lastEntry: null });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'An ingredient with that name already exists' });
    }
    throw err;
  }
}));

router.put('/ingredients/:id', requireManager, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, unit, costPerUnit } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Name is required' });
  if (!UNITS.includes(unit)) {
    return res.status(400).json({ error: `Unit must be one of: ${UNITS.join(', ')}` });
  }
  const perUnit = Number(costPerUnit) || 0;
  if (perUnit < 0) return res.status(400).json({ error: 'Price cannot be negative' });
  const db = getDb();
  const oldRow = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  if (!oldRow) return res.status(404).json({ error: 'Ingredient not found' });
  try {
    db.prepare('UPDATE ingredients SET name = ?, unit = ?, cost_per_unit = ? WHERE id = ?').run(trimmed, unit, perUnit, id);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'An ingredient with that name already exists' });
    }
    throw err;
  }
  const newRow = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  const authUser = req.user || {};
  auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'update', 'ingredient', id, oldRow, newRow);
  res.sendStatus(200);
}));

router.delete('/ingredients/:id', requireManager, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = getDb();
  const row = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Ingredient not found' });

  // History must stay coherent: an ingredient with ledger entries cannot vanish.
  const entries = db
    .prepare('SELECT COUNT(*) AS n FROM stock_entries WHERE ingredient_id = ?')
    .get(id);
  if (entries.n > 0) {
    return res.status(400).json({
      error: 'This ingredient has stock entries and cannot be deleted',
    });
  }

  const authUser = req.user || {};
  auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'delete', 'ingredient', id, row, null);
  db.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
  res.sendStatus(200);
}));

// Usage & wastage: manual deductions typed by the team. Sales never create entries.
router.post('/usage', requireManager, asyncHandler(async (req, res) => {
  const { ingredientId, quantity, type, note } = req.body || {};
  const qty = Number(quantity);
  const parsedId = parseInt(ingredientId, 10);

  if (!parsedId) return res.status(400).json({ error: 'Ingredient is required' });
  if (type !== 'usage' && type !== 'wastage') {
    return res.status(400).json({ error: "Type must be 'usage' or 'wastage'" });
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }
  if (type === 'wastage' && !String(note || '').trim()) {
    return res.status(400).json({ error: 'A reason is required for wastage' });
  }

  const db = getDb();
  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(parsedId);
  if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });

  const entryCount = db
    .prepare('SELECT COUNT(*) AS n FROM stock_entries WHERE ingredient_id = ?')
    .get(parsedId);
  const balanceRow = db
    .prepare(`${BALANCE_SELECT.replace('i.*,', 'i.id,')} WHERE i.id = ? GROUP BY i.id`)
    .get(parsedId);
  const balance = Number(balanceRow?.balance) || 0;
  if (!entryCount.n || qty > balance) {
    return res.status(400).json({
      error: `Not enough ${ingredient.name} in stock — this would push the balance below zero (current: ${balance} ${ingredient.unit})`,
    });
  }

  const authUser = req.user || {};
  const result = db
    .prepare(
      `INSERT INTO stock_entries (ingredient_id, type, quantity, note, user_id, user_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(parsedId, type, qty, String(note || ''), authUser.id || 0, authUser.fullname || '', new Date().toISOString());

  const row = db.prepare('SELECT * FROM stock_entries WHERE id = ?').get(result.lastInsertRowid);
  auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'create', 'stock_entry', row.id, null, {
    ...row,
    ingredient: ingredient.name,
  });
  res.json({ ok: true, id: row.id });
}));

// Money overview: what the stock on hand is worth + how much was spent buying stock.
router.get('/summary', requireManager, asyncHandler(async (req, res) => {
  const db = getDb();
  const rows = db.prepare(`${BALANCE_SELECT} GROUP BY i.id`).all();
  let stockWorth = 0;
  for (const r of rows) {
    stockWorth += (Number(r.balance) || 0) * (Number(r.cost_per_unit) || 0);
  }

  const { start, end } = req.query;
  let spentSql = "SELECT COALESCE(SUM(quantity * unit_cost), 0) AS spent FROM stock_entries WHERE type = 'restock'";
  const params = [];
  if (start) {
    spentSql += ' AND created_at >= ?';
    params.push(start);
  }
  if (end) {
    spentSql += ' AND created_at <= ?';
    params.push(end);
  }
  const spent = db.prepare(spentSql).get(...params);

  // Out of stock = has been stocked before but nothing left right now
  const outOfStock = rows.filter(
    (r) => (r.entry_count || 0) > 0 && (Number(r.balance) || 0) <= 0
  ).length;

  // Changes today = entries logged since the day started (local time)
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const changesToday = db
    .prepare('SELECT COUNT(*) AS n FROM stock_entries WHERE created_at >= ?')
    .get(dayStart.toISOString());

  res.json({
    items: rows.length,
    outOfStock,
    changesToday: Number(changesToday?.n) || 0,
    stockWorth: Math.round(stockWorth * 100) / 100,
    spentTotal: Math.round((Number(spent?.spent) || 0) * 100) / 100,
  });
}));

// Full movements history across all ingredients and entry types.
router.get('/entries', requireManager, asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const offset = parseInt(req.query.offset, 10) || 0;
  const { ingredientId, type, startDate, endDate } = req.query;

  let sql = `SELECT e.*, i.name AS ingredient_name, i.unit FROM stock_entries e JOIN ingredients i ON i.id = e.ingredient_id`;
  const conditions = [];
  const params = [];
  if (ingredientId) {
    conditions.push('e.ingredient_id = ?');
    params.push(parseInt(ingredientId, 10));
  }
  if (type) {
    conditions.push('e.type = ?');
    params.push(type);
  }
  if (startDate) {
    conditions.push('e.created_at >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('e.created_at <= ?');
    params.push(endDate);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  let countSql = 'SELECT COUNT(*) AS n FROM stock_entries e';
  if (conditions.length) countSql += ' WHERE ' + conditions.join(' AND ');
  const total = db.prepare(countSql).get(...params.slice(0, -2));

  const rows = db.prepare(sql).all(...params);
  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      ingredientId: r.ingredient_id,
      ingredientName: r.ingredient_name,
      unit: r.unit,
      type: r.type,
      quantity: Number(r.quantity),
      note: r.note || '',
      userId: r.user_id,
      userName: r.user_name,
      createdAt: r.created_at,
    })),
    total: total?.n || 0,
  });
}));

router.post('/restock', requireManager, asyncHandler(async (req, res) => {
  const { ingredientId, quantity, note, paid } = req.body || {};
  const qty = Number(quantity);
  const moneyPaid = Number(paid) || 0;
  const parsedId = parseInt(ingredientId, 10);
  if (!parsedId) return res.status(400).json({ error: 'Ingredient is required' });
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }
  if (moneyPaid < 0) {
    return res.status(400).json({ error: 'Paid amount cannot be negative' });
  }

  const db = getDb();
  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(parsedId);
  if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });

  // What you paid sets the item's per-unit price used for stock worth
  const unitCost = qty > 0 && moneyPaid > 0 ? Math.round((moneyPaid / qty) * 10000) / 10000 : 0;
  const authUser = req.user || {};
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO stock_entries (ingredient_id, type, quantity, unit_cost, note, user_id, user_name, created_at)
         VALUES (?, 'restock', ?, ?, ?, ?, ?, ?)`
      )
      .run(parsedId, qty, unitCost, String(note || ''), authUser.id || 0, authUser.fullname || '', new Date().toISOString());
    if (unitCost > 0) {
      db.prepare('UPDATE ingredients SET cost_per_unit = ? WHERE id = ?').run(unitCost, parsedId);
    }
    return result;
  });
  const result = tx();

  const row = db.prepare('SELECT * FROM stock_entries WHERE id = ?').get(result.lastInsertRowid);
  auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'create', 'stock_entry', row.id, null, {
    ...row,
    ingredient: ingredient.name,
  });
  res.json({ ok: true, id: row.id });
}));

export default router;
