import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, mapUser, auditLog } from '../db.js';
import {
  authenticate,
  requireAdmin,
  loginUser,
  loginByPinForUser,
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
  const { userId, pin } = req.body || {};
  if (!userId || !pin) {
    return res.status(400).json({ error: 'User and PIN required' });
  }
  const user = loginByPinForUser(parseInt(userId, 10), String(pin));
  if (!user) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }
  const token = signToken(user);
  res.json({ user, token, force_password_change: user.force_password_change });
}));

// Team member tiles for the identity-first login screen.
router.get('/pin-users', asyncHandler(async (_req, res) => {
  const rows = getDb()
    .prepare("SELECT id, fullname, role FROM users WHERE pin != '' ORDER BY fullname")
    .all();
  res.json(rows);
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
  res.sendStatus(200);
}));

router.get('/all', requireAdmin, asyncHandler(async (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM users ORDER BY id').all();
  res.json(rows.map(mapUser));
}));

router.delete(
  '/user/:userId',
  requireAdmin,
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

const VALID_ROLES = ['Admin', 'Manager', 'Cashier'];

function resolveRole(body) {
  if (!VALID_ROLES.includes(body.role)) return null;
  return body.role;
}

router.post('/post', requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const authUser = req.user || {};

  if (body.id && parseInt(body.id, 10) === 1 && body.role && body.role !== 'Admin') {
    return res.status(400).json({ error: 'The default admin must remain an Admin' });
  }
  const role = body.id
    ? (resolveRole(body) ?? db.prepare('SELECT role FROM users WHERE id = ?').get(parseInt(body.id, 10))?.role)
    : resolveRole(body);
  if (!role) {
    return res.status(400).json({ error: 'Role must be one of Admin, Manager, Cashier' });
  }

  if (!body.id) {
    const result = db
      .prepare(
        `INSERT INTO users (username, password, pin, fullname, role)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        body.username,
        hashPassword(body.password || 'password'),
        body.pin ? hashPassword(String(body.pin)) : '',
        body.fullname || '',
        role
      );
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'create', 'user', row.id, null, row);
    return res.json(mapUser(row));
  }

  const id = parseInt(body.id, 10);
  const oldRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const updates = ['username = ?', 'fullname = ?', 'role = ?'];
  const params = [body.username, body.fullname || '', role];
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
