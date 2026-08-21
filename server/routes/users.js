import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, mapUser, auditLog } from '../db.js';
import {
  authenticate,
  requirePerm,
  loginUser,
  loginByPin,
  signToken,
  hashPassword,
  asyncHandler,
  loginRateLimit,
} from '../auth.js';

const router = Router();

router.post('/login', loginRateLimit, asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = loginUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  const token = signToken(user);
  res.json({ user, token, force_password_change: user.force_password_change });
}));

router.post('/login-pin', loginRateLimit, asyncHandler(async (req, res) => {
  const { pin } = req.body || {};
  if (!pin) {
    return res.status(400).json({ error: 'PIN required' });
  }
  const user = loginByPin(String(pin));
  if (!user) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }
  const token = signToken(user);
  res.json({ user, token, force_password_change: user.force_password_change });
}));

router.get('/check', asyncHandler(async (_req, res) => {
  const admin = getDb().prepare('SELECT id FROM users WHERE id = 1').get();
  res.json({ ready: !!admin });
}));

router.use(authenticate);

router.get('/user/:userId', asyncHandler(async (req, res) => {
  const row = getDb()
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(parseInt(req.params.userId, 10));
  res.json(mapUser(row));
}));

router.get('/logout/:userId', asyncHandler(async (req, res) => {
  getDb()
    .prepare('UPDATE users SET status = ? WHERE id = ?')
    .run(`Logged Out_${new Date().toISOString()}`, parseInt(req.params.userId, 10));
  res.sendStatus(200);
}));

router.get('/all', requirePerm('perm_users'), asyncHandler(async (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM users ORDER BY id').all();
  res.json(rows.map(mapUser));
}));

router.delete(
  '/user/:userId',
  requirePerm('perm_users'),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.userId, 10);
    if (id === 1) {
      return res.status(400).json({ error: 'Cannot delete the default admin' });
    }
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (row) {
      const authUser = req.user || {};
      auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'delete', 'user', id, row, null);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.sendStatus(200);
  })
);

router.post('/post', requirePerm('perm_users'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const perms = {
    perm_products: body.perm_products ? 1 : 0,
    perm_categories: body.perm_categories ? 1 : 0,
    perm_transactions: body.perm_transactions ? 1 : 0,
    perm_users: body.perm_users ? 1 : 0,
    perm_settings: body.perm_settings ? 1 : 0,
  };
  const db = getDb();
  const authUser = req.user || {};

  if (!body.id) {
    const result = db
      .prepare(
        `INSERT INTO users (username, password, pin, fullname, perm_products, perm_categories, perm_transactions, perm_users, perm_settings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.username,
        hashPassword(body.password || 'password'),
        body.pin ? hashPassword(String(body.pin)) : '',
        body.fullname || '',
        perms.perm_products,
        perms.perm_categories,
        perms.perm_transactions,
        perms.perm_users,
        perms.perm_settings
      );
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'create', 'user', row.id, null, row);
    return res.json(mapUser(row));
  }

  const id = parseInt(body.id, 10);
  const oldRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const updates = [
    'username = ?',
    'fullname = ?',
    'perm_products = ?',
    'perm_categories = ?',
    'perm_transactions = ?',
    'perm_users = ?',
    'perm_settings = ?',
  ];
  const params = [
    body.username,
    body.fullname || '',
    perms.perm_products,
    perms.perm_categories,
    perms.perm_transactions,
    perms.perm_users,
    perms.perm_settings,
  ];
  if (body.password) {
    updates.push('password = ?');
    params.push(hashPassword(body.password));
  }
  if (body.pin) {
    updates.push('pin = ?');
    params.push(hashPassword(String(body.pin)));
  }
  params.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const newRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'update', 'user', id, oldRow, newRow);
  res.sendStatus(200);
}));

router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body || {};
  const userId = req.user.id;

  if (!current_password || !new_password || !confirm_password) {
    return res.status(400).json({ error: 'Current password, new password, and confirmation are required' });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({ error: 'New password and confirmation do not match' });
  }

  if (new_password.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!bcrypt.compareSync(current_password, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = hashPassword(new_password);
  db.prepare('UPDATE users SET password = ?, force_password_change = 0 WHERE id = ?').run(newHash, userId);

  res.json({ ok: true, message: 'Password changed successfully' });
}));

export default router;
