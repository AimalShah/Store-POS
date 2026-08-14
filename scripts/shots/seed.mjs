import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from '../../server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, 'pos-data');
const dbPath = path.join(root, 'pos-v3.sqlite');
const uploadsPath = path.join(root, 'uploads');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(uploadsPath, { recursive: true });

const app = await createServer({
  dbPath,
  uploadsPath,
  jwtSecret: 'screenshot-secret',
});

const server = app.listen(8001, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = 'http://127.0.0.1:8001';
console.log('API ready on', base);

async function req(pathname, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${pathname}`, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${pathname} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const login = await req('/api/users/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'admin', password: 'admin' }),
});
const token = login.token;
if (!token) throw new Error('no token from login');

// Set the admin PIN to 123456 (bcrypt-hashed server side).
await req('/api/users/1', {
  method: 'PUT',
  body: JSON.stringify({ pin: '123456' }),
}, token);
console.log('PIN set to 123456');

const seed = await req('/api/demo/seed', { method: 'POST' }, token);
console.log('demo seed:', JSON.stringify(seed));

console.log('SEED_DONE');
// Keep the server alive for the capture run.
process.stdin.resume();
