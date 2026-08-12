import { Router } from 'express';
import { getDb } from '../db.js';
import { requirePerm } from '../auth.js';

const router = Router();

const METHOD_BY_TYPE = { 1: 'cash', 2: 'card', 3: 'mobile' };

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return fallback;
  }
}

function itemLineTotal(item) {
  const base = Number(item.price) * Number(item.quantity);
  if (!item.discountValue || item.discountValue <= 0) return base;
  if (item.discountType === 'percent') {
    return Math.max(0, base * (1 - Number(item.discountValue) / 100));
  }
  return Math.max(0, base - Number(item.discountValue));
}

// Summarise paid sales over a date range: totals by category and payment
// method, plus best-selling items. Kept server-side so the report can be
// pushed through the export path later.
router.get('/summary', requirePerm('perm_transactions'), (req, res) => {
  const startRaw = String(req.query.start || '');
  const endRaw = String(req.query.end || '');
  let start = null;
  let end = null;
  if (startRaw) start = new Date(startRaw);
  if (endRaw) end = new Date(endRaw);
  if ((startRaw && Number.isNaN(start.getTime())) || (endRaw && Number.isNaN(end.getTime()))) {
    return res.status(400).json({ error: 'Invalid start or end date' });
  }

  const db = getDb();

  let sql = `SELECT * FROM transactions WHERE status = 1`;
  const params = [];
  if (start) {
    sql += ' AND date >= ?';
    params.push(start.toISOString());
  }
  if (end) {
    sql += ' AND date <= ?';
    params.push(end.toISOString());
  }
  const till = parseInt(String(req.query.till), 10) || 0;
  if (till) {
    sql += ' AND till = ?';
    params.push(till);
  }
  sql += ' ORDER BY date ASC';

  const rows = db.prepare(sql).all(...params);

  const productCats = new Map(
    db.prepare('SELECT id, category FROM products').all().map((p) => [p.id, p.category])
  );

  let saleCount = 0;
  let itemsSold = 0;
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  let totalSales = 0;

  const byCategory = new Map();
  const byPayment = new Map();
  const bestSellers = new Map();

  for (const row of rows) {
    saleCount += 1;
    subtotal += row.subtotal || 0;
    discount += row.discount || 0;
    tax += row.tax || 0;
    totalSales += row.total || 0;

    let breakdown = parseJson(row.payment_breakdown_json, []);
    if (!breakdown.length) {
      breakdown = [
        { method: METHOD_BY_TYPE[row.payment_type] || 'cash', amount: row.total || 0 },
      ];
    }
    for (const pb of breakdown) {
      const method = pb.method || METHOD_BY_TYPE[row.payment_type] || 'cash';
      const current = byPayment.get(method) || { method, count: 0, amount: 0 };
      current.count += 1;
      current.amount += Number(pb.amount) || 0;
      byPayment.set(method, current);
    }

    const items = parseJson(row.items_json, []);
    for (const item of items) {
      const lineTotal = itemLineTotal(item);
      const qty = Number(item.quantity) || 0;
      itemsSold += qty;

      const productId = parseInt(item.id ?? item._id, 10);
      const category = (productId && productCats.get(productId)) || 'Uncategorized';
      const catCurrent = byCategory.get(category) || { category, count: 0, revenue: 0 };
      catCurrent.count += qty;
      catCurrent.revenue += lineTotal;
      byCategory.set(category, catCurrent);

      const sellerKey = productId || item.name || 'Unknown';
      const sellerCurrent = bestSellers.get(sellerKey) || {
        productId: productId || null,
        name: item.name || 'Unknown',
        quantity: 0,
        revenue: 0,
      };
      sellerCurrent.quantity += qty;
      sellerCurrent.revenue += lineTotal;
      bestSellers.set(sellerKey, sellerCurrent);
    }
  }

  res.json({
    summary: { saleCount, itemsSold, subtotal, discount, tax, totalSales },
    byCategory: [...byCategory.values()].sort((a, b) => b.revenue - a.revenue),
    byPaymentMethod: [...byPayment.values()].sort((a, b) => b.amount - a.amount),
    bestSellers: [...bestSellers.values()].sort(
      (a, b) => b.quantity - a.quantity || b.revenue - a.revenue
    ),
  });
});

export default router;
