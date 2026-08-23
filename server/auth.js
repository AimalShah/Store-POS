import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { getDb, mapUser, loadJwtSecret } from './db.js';
import logger from './logger.js';

let jwtSecret = null;

function assertJwtSecret() {
  if (!jwtSecret) {
    throw new Error('JWT secret not initialized. Call setJwtSecret() first.');
  }
}

const loginAttempts = new Map();
const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS) || 50;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

function cleanupExpiredAttempts() {
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts.entries()) {
    const validAttempts = attempts.filter((t) => now - t < WINDOW_MS);
    if (validAttempts.length === 0) {
      loginAttempts.delete(ip);
    } else {
      loginAttempts.set(ip, validAttempts);
    }
  }
}

setInterval(cleanupExpiredAttempts, 60 * 1000);

export function loginRateLimit(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  const ip = getClientIp(req);
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recentAttempts = attempts.filter((t) => now - t < WINDOW_MS);

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((recentAttempts[0] + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }

  recentAttempts.push(now);
  loginAttempts.set(ip, recentAttempts);
  next();
}

export function resetLoginRateLimit() {
  loginAttempts.clear();
}

export function setJwtSecret(secret) {
  if (!secret) {
    throw new Error('JWT secret cannot be empty');
  }
  jwtSecret = secret;
}

export const ROLES = ['Admin', 'Manager', 'Cashier'];

export function signToken(user) {
  assertJwtSecret();
  return jwt.sign(
    {
      id: user.id || user._id,
      username: user.username,
      fullname: user.fullname,
    },
    jwtSecret,
    { expiresIn: '12h' }
  );
}

export function verifyToken(token) {
  assertJwtSecret();
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

// Role is resolved fresh from the database on every request, never trusted
// from the token — a role change takes effect on the next request (ADR-0006).
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const row = getDb().prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!row) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    if (!roles.includes(row.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    req.role = row.role;
    return next();
  };
}

export const requireAdmin = requireRole('Admin');
export const requireManager = requireRole('Admin', 'Manager');
export const requireStaff = requireRole('Admin', 'Manager', 'Cashier');

function stampLastLogin(userId) {
  getDb()
    .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .run(new Date().toISOString(), userId);
}

export function loginUser(username, password) {
  const row = getDb()
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username);
  if (!row) return null;
  if (!bcrypt.compareSync(password, row.password)) return null;
  stampLastLogin(row.id);
  return mapUser(row);
}

// Identity-first: verify against one specific member's hash — never iterate rows.
export function loginByPinForUser(userId, pin) {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row || !row.pin) return null;
  if (!bcrypt.compareSync(String(pin), row.pin)) return null;
  stampLastLogin(row.id);
  return mapUser(row);
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
