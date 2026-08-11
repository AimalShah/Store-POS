import { Router } from 'express';
import { getDb } from '../db.js';
import { hashPassword } from '../auth.js';

const router = Router();

router.get('/first-run', (_req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT first_run FROM settings WHERE id = 1').get();
  res.json({ firstRun: !!settings?.first_run });
});

router.post('/first-run', (req, res) => {
  const body = req.body || {};
  const store = String(body.store || '').trim();
  const pin = String(body.pin || '');
  if (!store) {
    return res.status(400).json({ error: 'Store name is required' });
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4–6 digits' });
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare('UPDATE settings SET store = ?, first_run = 0 WHERE id = 1').run(store);
    db.prepare('UPDATE users SET pin = ? WHERE id = 1').run(hashPassword(pin));
  })();
  res.json({ ok: true });
});

export default router;
