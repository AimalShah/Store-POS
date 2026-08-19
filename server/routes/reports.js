import { Router } from 'express';
import { requirePerm, asyncHandler } from '../auth.js';
import { computeSalesSummary, computeBestSellers } from '../lib/sales.js';

const router = Router();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Summarise paid sales over a date range: totals by category and payment
// method, plus best-selling items. Reuses the shared sales aggregation so
// the report and the best-sellers endpoint stay consistent.
router.get('/summary', requirePerm('perm_transactions'), asyncHandler(async (req, res) => {
  const startRaw = String(req.query.start || '');
  const endRaw = String(req.query.end || '');
  let start = null;
  let end = null;
  if (startRaw) start = new Date(startRaw);
  if (endRaw) end = new Date(endRaw);
  if ((startRaw && Number.isNaN(start.getTime())) || (endRaw && Number.isNaN(end.getTime()))) {
    return res.status(400).json({ error: 'Invalid start or end date' });
  }

  const till = parseInt(String(req.query.till), 10) || 0;

  res.json(computeSalesSummary({ start, end, till }));
}));

// Top products by units sold over the trailing 30 days (falls back to
// all-time when the window has no sales). Used by the till's Best Sellers view.
router.get('/best-sellers', requirePerm('perm_transactions'), asyncHandler(async (req, res) => {
  const till = parseInt(String(req.query.till), 10) || 0;
  const limit = parseInt(String(req.query.limit), 10) || 0;

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - THIRTY_DAYS_MS);

  let ranked = computeBestSellers({ start: windowStart, end: windowEnd, till, limit: limit || undefined });

  if (ranked.length === 0) {
    ranked = computeBestSellers({ till, limit: limit || undefined });
  }

  res.json(ranked);
}));

export default router;
