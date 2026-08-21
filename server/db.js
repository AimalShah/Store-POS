import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import logger from './logger.js';

const SCHEMA_VERSION = 1;

let db = null;
let dbPath = null;
let uploadsPath = null;

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function getDbPath() {
  return dbPath;
}

export function getUploadsPath() {
  if (!uploadsPath) throw new Error('Uploads path not initialized');
  return uploadsPath;
}

export function setUploadsPath(path) {
  uploadsPath = path;
}

export async function initDatabase(filePath) {
  dbPath = filePath;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');

  logger.debug('Starting db.exec() for schema creation');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      pin TEXT NOT NULL DEFAULT '',
      fullname TEXT NOT NULL DEFAULT '',
      perm_products INTEGER NOT NULL DEFAULT 0,
      perm_categories INTEGER NOT NULL DEFAULT 0,
      perm_transactions INTEGER NOT NULL DEFAULT 0,
      perm_users INTEGER NOT NULL DEFAULT 0,
      perm_settings INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '',
      force_password_change INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT 'Utensils',
      color TEXT NOT NULL DEFAULT 'gray'
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT '',
      category_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      img TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'sale', 'restock', 'wastage', 'adjustment'
      quantity_change INTEGER NOT NULL, -- negative for deduction, positive for addition
      quantity_after INTEGER NOT NULL,
      reason TEXT,
      reference_id INTEGER, -- transaction id for sales
      reference_type TEXT, -- 'transaction', 'manual'
      user_id INTEGER NOT NULL DEFAULT 0,
      user_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);

    CREATE TABLE IF NOT EXISTS product_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_product_id INTEGER NOT NULL,
      component_product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (parent_product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_product_components_parent ON product_components(parent_product_id);

    CREATE TABLE IF NOT EXISTS product_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_product_sizes_product ON product_sizes(product_id);

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      app TEXT NOT NULL DEFAULT 'Standalone Point of Sale',
      store TEXT NOT NULL DEFAULT '',
      address_one TEXT NOT NULL DEFAULT '',
      address_two TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      tax TEXT NOT NULL DEFAULT '',
      symbol TEXT NOT NULL DEFAULT 'Rs',
      percentage REAL NOT NULL DEFAULT 0,
      charge_tax INTEGER NOT NULL DEFAULT 0,
      footer TEXT NOT NULL DEFAULT '',
      img TEXT NOT NULL DEFAULT '',
      till INTEGER NOT NULL DEFAULT 1,
      server_ip TEXT NOT NULL DEFAULT '',
      first_run INTEGER NOT NULL DEFAULT 1,
      jwt_secret TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS media_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'upload',
      pexels_id INTEGER,
      photographer TEXT NOT NULL DEFAULT '',
      alt TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS printer_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      interface TEXT NOT NULL DEFAULT '', -- '', 'usb', 'network'
      usb_device TEXT NOT NULL DEFAULT '',
      network_host TEXT NOT NULL DEFAULT '',
      network_port INTEGER NOT NULL DEFAULT 9100,
      width INTEGER NOT NULL DEFAULT 58, -- 58 or 80
      kot_interface TEXT NOT NULL DEFAULT '',
      kot_usb_device TEXT NOT NULL DEFAULT '',
      kot_network_host TEXT NOT NULL DEFAULT '',
      kot_network_port INTEGER NOT NULL DEFAULT 9100,
      kot_width INTEGER NOT NULL DEFAULT 58,
      auto_print_kot INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_number TEXT NOT NULL DEFAULT '',
      customer TEXT NOT NULL DEFAULT '0',
      customer_name TEXT NOT NULL DEFAULT '',
      status INTEGER NOT NULL DEFAULT 1,
      user_id INTEGER NOT NULL DEFAULT 0,
      user_name TEXT NOT NULL DEFAULT '',
      till INTEGER NOT NULL DEFAULT 1,
      discount REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paid REAL NOT NULL DEFAULT 0,
      change REAL NOT NULL DEFAULT 0,
      payment_type INTEGER NOT NULL DEFAULT 1,
      payment_breakdown_json TEXT NOT NULL DEFAULT '[]',
      items_json TEXT NOT NULL DEFAULT '[]',
      date TEXT NOT NULL,
      shift_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 0,
      user_name TEXT NOT NULL DEFAULT '',
      till INTEGER NOT NULL DEFAULT 1,
      float_amount REAL NOT NULL DEFAULT 0,
      counted_cash REAL,
      status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      x_report_json TEXT,
      z_report_json TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
    CREATE INDEX IF NOT EXISTS idx_shifts_till ON shifts(till);

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_till ON transactions(till);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 0,
      user_name TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL, -- 'create', 'update', 'delete', 'void'
      entity_type TEXT NOT NULL, -- 'transaction', 'product', 'customer', 'user', 'settings', 'category', 'shift', 'drawer_session'
      entity_id INTEGER,
      old_value TEXT, -- JSON snapshot before change
      new_value TEXT, -- JSON snapshot after change
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
  `);

logger.debug('db.exec() completed successfully');
   
  // Migration: add payment_breakdown_json column if it doesn't exist
  try {
    const cols = db.prepare("PRAGMA table_info(transactions)").all();
    if (!cols.some((c) => c.name === 'payment_breakdown_json')) {
      db.prepare("ALTER TABLE transactions ADD COLUMN payment_breakdown_json TEXT NOT NULL DEFAULT '[]'").run();
    }
  } catch {
    /* ignore */
  }

  // Migration: add icon and color columns to categories if they don't exist
  try {
    const cols = db.prepare('PRAGMA table_info(categories)').all();
    if (!cols.some((c) => c.name === 'icon')) {
      db.prepare("ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'Utensils'").run();
    }
    if (!cols.some((c) => c.name === 'color')) {
      db.prepare("ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT 'gray'").run();
    }
  } catch {
    /* ignore */
  }

  // Migration: add low_stock_threshold column to products if it doesn't exist
  try {
    const cols = db.prepare("PRAGMA table_info(products)").all();
    if (!cols.some((c) => c.name === 'low_stock_threshold')) {
      db.prepare("ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 10").run();
    }
    if (!cols.some((c) => c.name === 'stock')) {
      db.prepare("ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0").run();
    }
    if (!cols.some((c) => c.name === 'cost')) {
      db.prepare("ALTER TABLE products ADD COLUMN cost REAL NOT NULL DEFAULT 0").run();
    }
    if (!cols.some((c) => c.name === 'variants_json')) {
      db.prepare("ALTER TABLE products ADD COLUMN variants_json TEXT NOT NULL DEFAULT '[]'").run();
    }
    if (!cols.some((c) => c.name === 'modifiers_json')) {
      db.prepare("ALTER TABLE products ADD COLUMN modifiers_json TEXT NOT NULL DEFAULT '[]'").run();
    }
    if (!cols.some((c) => c.name === 'hot')) {
      db.prepare("ALTER TABLE products ADD COLUMN hot INTEGER NOT NULL DEFAULT 0").run();
    }
  } catch {
    /* ignore */
  }

  // Migration: add fulfillment + delivery columns to transactions if missing
  try {
    const txCols = db.prepare('PRAGMA table_info(transactions)').all();
    const addTxCol = (name, def) => {
      if (!txCols.some((c) => c.name === name)) {
        db.prepare(`ALTER TABLE transactions ADD COLUMN ${name} ${def}`).run();
      }
    };
    addTxCol('fulfillment', "TEXT NOT NULL DEFAULT 'takeaway'");
    addTxCol('delivery_name', "TEXT NOT NULL DEFAULT ''");
    addTxCol('delivery_contact', "TEXT NOT NULL DEFAULT ''");
    addTxCol('delivery_address', "TEXT NOT NULL DEFAULT ''");
  } catch {
    /* ignore */
  }

  // Migration: create stock_movements table if it doesn't exist
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").all();
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE stock_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          quantity_change INTEGER NOT NULL,
          quantity_after INTEGER NOT NULL,
          reason TEXT,
          reference_id INTEGER,
          reference_type TEXT,
          user_id INTEGER NOT NULL DEFAULT 0,
          user_name TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
        CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);
      `);
    }
  } catch {
    /* ignore */
  }

  // Migration: create shifts table if it doesn't exist
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shifts'").all();
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL DEFAULT 0,
          user_name TEXT NOT NULL DEFAULT '',
          till INTEGER NOT NULL DEFAULT 1,
          float_amount REAL NOT NULL DEFAULT 0,
          counted_cash REAL,
          status TEXT NOT NULL DEFAULT 'open',
          opened_at TEXT NOT NULL,
          closed_at TEXT,
          x_report_json TEXT,
          z_report_json TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX idx_shifts_user ON shifts(user_id);
        CREATE INDEX idx_shifts_status ON shifts(status);
        CREATE INDEX idx_shifts_till ON shifts(till);
      `);
    }
  } catch {
    /* ignore */
  }

  // Migration: create drawer sessions table if it doesn't exist
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='drawer_sessions'").all();
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE drawer_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL DEFAULT 0,
          user_name TEXT NOT NULL DEFAULT '',
          till INTEGER NOT NULL DEFAULT 1,
          float_amount REAL NOT NULL DEFAULT 0,
          counted_cash REAL,
          variance REAL,
          status TEXT NOT NULL DEFAULT 'open',
          opened_at TEXT NOT NULL,
          closed_at TEXT
        );
        CREATE INDEX idx_drawer_sessions_till ON drawer_sessions(till);
      `);
    }
  } catch {
    /* ignore */
  }

  // Migration: add user_id and user_name columns to drawer_sessions if missing
  try {
    const cols = db.prepare("PRAGMA table_info(drawer_sessions)").all();
    if (!cols.some((c) => c.name === 'user_id')) {
      db.prepare("ALTER TABLE drawer_sessions ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0").run();
    }
    if (!cols.some((c) => c.name === 'user_name')) {
      db.prepare("ALTER TABLE drawer_sessions ADD COLUMN user_name TEXT NOT NULL DEFAULT ''").run();
    }
  } catch {
    /* ignore */
  }

  // Migration: add cost column to product_sizes if it doesn't exist
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_sizes'").all();
    if (tables.length === 0) {
      // Table doesn't exist yet, add cost column in the main schema creation
      // This will be handled by the main schema creation below
    }
  } catch {
    /* ignore */
  }

  // Migration: add shift_id column to transactions if it doesn't exist
  try {
    const cols = db.prepare("PRAGMA table_info(transactions)").all();
    if (!cols.some((c) => c.name === 'shift_id')) {
      db.prepare("ALTER TABLE transactions ADD COLUMN shift_id INTEGER").run();
      db.prepare("CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift_id)").run();
    }
  } catch {
    /* ignore */
  }

  // Migration: create printer_settings table if it doesn't exist
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='printer_settings'").all();
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE printer_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          interface TEXT NOT NULL DEFAULT '',
          usb_device TEXT NOT NULL DEFAULT '',
          network_host TEXT NOT NULL DEFAULT '',
          network_port INTEGER NOT NULL DEFAULT 9100,
          width INTEGER NOT NULL DEFAULT 58,
          kot_interface TEXT NOT NULL DEFAULT '',
          kot_usb_device TEXT NOT NULL DEFAULT '',
          kot_network_host TEXT NOT NULL DEFAULT '',
          kot_network_port INTEGER NOT NULL DEFAULT 9100,
          kot_width INTEGER NOT NULL DEFAULT 58,
          auto_print_kot INTEGER NOT NULL DEFAULT 0
        );
      `);
    }
  } catch {
    /* ignore */
  }

  // Migration: add category_id column to products and populate from category name
  try {
    const productCols = db.prepare("PRAGMA table_info(products)").all();
    if (!productCols.some((c) => c.name === 'category_id')) {
      db.prepare("ALTER TABLE products ADD COLUMN category_id INTEGER").run();
      db.prepare("CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)").run();
      
      // Add FK constraint (requires recreating table in SQLite, but we can add index)
      // Populate category_id from existing category name references
      const products = db.prepare("SELECT id, category FROM products WHERE category != ''").all();
      for (const p of products) {
        const cat = db.prepare("SELECT id FROM categories WHERE name = ?").get(p.category);
        if (cat) {
          db.prepare("UPDATE products SET category_id = ? WHERE id = ?").run(cat.id, p.id);
        }
      }
    }
  } catch {
    /* ignore */
  }

  // Migration: add UNIQUE constraint on categories.name if not exists (requires table rebuild in SQLite)
  // SQLite doesn't support ADD CONSTRAINT UNIQUE on existing column easily
  // We handle deduplication at application level
  
  // Migration: deduplicate categories (keep oldest by id, reassign products)
  try {
    const dupNames = db.prepare(
      `SELECT name FROM categories GROUP BY name HAVING COUNT(*) > 1`
    ).all();
    for (const { name } of dupNames) {
      const duplicates = db
        .prepare(`SELECT id FROM categories WHERE name = ? ORDER BY id ASC`)
        .all(name);
      const keepId = duplicates[0].id;
      const removeIds = duplicates.slice(1).map((d) => d.id);
      // Reassign products from duplicates to the kept category
      for (const removeId of removeIds) {
        db.prepare('UPDATE products SET category_id = ? WHERE category_id = ?').run(keepId, removeId);
        // Also update legacy category name field
        db.prepare('UPDATE products SET category = ? WHERE category_id = ?').run(name, keepId);
      }
      // Delete duplicate categories
      for (const removeId of removeIds) {
        db.prepare('DELETE FROM categories WHERE id = ?').run(removeId);
      }
    }
  } catch {
    /* ignore */
  }

  const versionRow = db.prepare('SELECT version FROM schema_version WHERE id = 1').get();
  if (!versionRow) {
    db.prepare('INSERT INTO schema_version (id, version) VALUES (1, ?)').run(SCHEMA_VERSION);
    logger.info({ filePath, schemaVersion: SCHEMA_VERSION }, 'Fresh database created');
  } else if (versionRow.version !== SCHEMA_VERSION) {
    logger.warn(
      { dbVersion: versionRow.version, appVersion: SCHEMA_VERSION },
      'Schema version mismatch'
    );
  }

  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes('force_password_change')) {
    logger.info('Adding force_password_change column to users table');
    db.exec('ALTER TABLE users ADD COLUMN force_password_change INTEGER NOT NULL DEFAULT 0');
  }

  const settingsCols = db.prepare("PRAGMA table_info(settings)").all().map((c) => c.name);
  if (!settingsCols.includes('jwt_secret')) {
    logger.info('Adding jwt_secret column to settings table');
    db.exec('ALTER TABLE settings ADD COLUMN jwt_secret TEXT NOT NULL DEFAULT ""');
  }

  seedDefaults();
  return db;
}

function seedDefaults() {
  const admin = db.prepare('SELECT id FROM users WHERE id = 1').get();
  if (!admin) {
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare(
      `INSERT INTO users (id, username, password, fullname, perm_products, perm_categories, perm_transactions, perm_users, perm_settings, force_password_change)
       VALUES (1, 'admin', ?, 'Administrator', 1, 1, 1, 1, 1, 1)`
    ).run(hash);
  } else {
    // Ensure existing admin has force_password_change flag set
    db.prepare("UPDATE users SET force_password_change = 1 WHERE id = 1 AND username = 'admin'").run();
  }

  const settings = db.prepare('SELECT id, jwt_secret FROM settings WHERE id = 1').get();
  if (!settings) {
    db.prepare(
      `INSERT INTO settings (id, app, store, symbol, percentage, charge_tax, till)
       VALUES (1, 'Standalone Point of Sale', 'My Store', 'Rs', 0, 0, 1)`
    ).run();
  }

  // Generate and store JWT secret if not present
  const currentSettings = db.prepare('SELECT jwt_secret FROM settings WHERE id = 1').get();
  if (!currentSettings.jwt_secret) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    db.prepare('UPDATE settings SET jwt_secret = ? WHERE id = 1').run(jwtSecret);
    logger.info('Generated new JWT secret');
  }

  // Migrate any legacy '$' currency symbol to PKR (Rs).
  db.prepare(`UPDATE settings SET symbol = 'Rs' WHERE symbol = '$' OR symbol IS NULL`).run();

  const walkIn = db.prepare("SELECT id FROM customers WHERE name = 'Walk-in Customer'").get();
  if (!walkIn) {
    db.prepare(
      `INSERT INTO customers (name, phone, email, address) VALUES ('Walk-in Customer', '', '', '')`
    ).run();
  }

  const printerSettings = db.prepare('SELECT id FROM printer_settings WHERE id = 1').get();
  if (!printerSettings) {
    db.prepare(`INSERT INTO printer_settings (id) VALUES (1)`).run();
  }
}

export function mapUser(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    username: row.username,
    fullname: row.fullname,
    has_pin: !!row.pin,
    perm_products: row.perm_products,
    perm_categories: row.perm_categories,
    perm_transactions: row.perm_transactions,
    perm_users: row.perm_users,
    perm_settings: row.perm_settings,
    force_password_change: !!row.force_password_change,
    status: row.status,
  };
}

export function mapProduct(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    price: row.price,
    cost: row.cost || 0,
    category: row.category,
    category_id: row.category_id,
    quantity: row.quantity,
    stock: row.stock,
    trackStock: !!row.stock,
    lowStockThreshold: row.low_stock_threshold || 10,
    img: row.img,
    components: [],
  };
}

export function mapCategory(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    icon: row.icon || 'Utensils',
    color: row.color || 'gray',
  };
}

export function mapCustomer(row) {
  if (!row) return null;
  return {
    _id: String(row.id),
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
  };
}

export function mapTransaction(row) {
  if (!row) return null;
  let items = [];
  try {
    items = JSON.parse(row.items_json || '[]');
  } catch {
    items = [];
  }
  let payment_breakdown = [];
  try {
    payment_breakdown = JSON.parse(row.payment_breakdown_json || '[]');
  } catch {
    payment_breakdown = [];
  }
  return {
    _id: row.id,
    id: row.id,
    ref_number: row.ref_number,
    customer: row.customer,
    customer_name: row.customer_name,
    status: row.status,
    user_id: row.user_id,
    user: row.user_name,
    till: row.till,
    discount: row.discount,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    paid: row.paid,
    change: row.change,
    payment_type: row.payment_type,
    payment_breakdown,
    items,
    date: row.date,
    shift_id: row.shift_id,
    fulfillment: row.fulfillment,
    delivery_name: row.delivery_name,
    delivery_contact: row.delivery_contact,
    delivery_address: row.delivery_address,
  };
}

export function mapShift(row) {
  if (!row) return null;
  let xReport = null;
  let zReport = null;
  try {
    xReport = row.x_report_json ? JSON.parse(row.x_report_json) : null;
  } catch {
    logger.warn({ shiftId: row.id }, 'Corrupted x_report_json in shift');
  }
  try {
    zReport = row.z_report_json ? JSON.parse(row.z_report_json) : null;
  } catch {
    logger.warn({ shiftId: row.id }, 'Corrupted z_report_json in shift');
  }
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    till: row.till,
    floatAmount: row.float_amount,
    countedCash: row.counted_cash,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    xReport,
    zReport,
  };
}

export function mapSettings(row) {
  if (!row) return null;
  return {
    _id: 1,
    settings: {
      app: row.app,
      store: row.store,
      address_one: row.address_one,
      address_two: row.address_two,
      contact: row.contact,
      tax: row.tax,
      symbol: row.symbol,
      percentage: row.percentage,
      charge_tax: !!row.charge_tax,
      footer: row.footer,
      img: row.img,
      till: row.till,
    },
  };
}

export function mapPrinterSettings(row) {
  if (!row) return null;
  return {
    interface: row.interface || '',
    usbDevice: row.usb_device || '',
    networkHost: row.network_host || '',
    networkPort: row.network_port || 9100,
    width: row.width || 58,
    kotInterface: row.kot_interface || '',
    kotUsbDevice: row.kot_usb_device || '',
    kotNetworkHost: row.kot_network_host || '',
    kotNetworkPort: row.kot_network_port || 9100,
    kotWidth: row.kot_width || 58,
    autoPrintKot: !!row.auto_print_kot,
  };
}

export function auditLog(db, userId, userName, action, entityType, entityId, oldValue, newValue) {
  db.prepare(
    `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(userId, userName, action, entityType, entityId, 
    oldValue ? JSON.stringify(oldValue) : null, 
    newValue ? JSON.stringify(newValue) : null);
}

export function mapAuditLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldValue: row.old_value ? JSON.parse(row.old_value) : null,
    newValue: row.new_value ? JSON.parse(row.new_value) : null,
    createdAt: row.created_at,
  };
}

export function loadJwtSecret() {
  const settings = db.prepare('SELECT jwt_secret FROM settings WHERE id = 1').get();
  if (!settings || !settings.jwt_secret) {
    throw new Error('JWT secret not found in database. Run setup first.');
  }
  return settings.jwt_secret;
}
