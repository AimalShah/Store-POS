import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { getDb, mapUser } from './db.js';
import logger from './logger.js';

let jwtSecret = 'store-pos-dev-secret';

export function setJwtSecret(secret) {
  jwtSecret = secret || jwtSecret;
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      username: user.username,
      fullname: user.fullname,
      perm_products: user.perm_products,
      perm_categories: user.perm_categories,
      perm_transactions: user.perm_transactions,
      perm_users: user.perm_users,
      perm_settings: user.perm_settings,
    },
    jwtSecret,
    { expiresIn: '12h' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.id === 1 || req.user[perm]) {
      return next();
    }
    return res.status(403).json({ error: 'Permission denied' });
  };
}

export function requireAnyPerm(...perms) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.id === 1 || perms.some((perm) => req.user[perm])) {
      return next();
    }
    return res.status(403).json({ error: 'Permission denied' });
  };
}

export function loginUser(username, password) {
  const row = getDb()
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username);
  if (!row) return null;
  if (!bcrypt.compareSync(password, row.password)) return null;

  getDb()
    .prepare('UPDATE users SET status = ? WHERE id = ?')
    .run(`Logged In_${new Date().toISOString()}`, row.id);

  return mapUser(row);
}

export function loginByPin(pin) {
  const users = getDb().prepare("SELECT * FROM users WHERE pin != ''").all();
  for (const row of users) {
    if (bcrypt.compareSync(String(pin), row.pin)) {
      getDb()
        .prepare('UPDATE users SET status = ? WHERE id = ?')
        .run(`Logged In_${new Date().toISOString()}`, row.id);
      return mapUser(row);
    }
  }
  return null;
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      logger.error({ err: err.message, stack: err.stack, path: req.path, method: req.method }, 'Route error');
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Duplicate entry' });
      }
      if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return res.status(400).json({ error: 'Referenced record not found' });
      }
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large (max 5MB)' });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err.message && err.message.startsWith('Only image')) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'Server error' });
    });
  };
}
