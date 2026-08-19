import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb, mapProduct, auditLog } from '../db.js';
import { requirePerm, asyncHandler } from '../auth.js';
import logger from '../logger.js';

function mapProductWithComponents(row, db) {
  if (!row) return null;
  const components = db
    .prepare(
      `SELECT pc.component_product_id as id, pc.quantity, p.name, p.price
       FROM product_components pc
       JOIN products p ON p.id = pc.component_product_id
       WHERE pc.parent_product_id = ?`
    )
    .all(row.id);
  const sizes = db
    .prepare(
      `SELECT id, name, price, position FROM product_sizes WHERE product_id = ? ORDER BY position, id`
    )
    .all(row.id);
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
    hot: !!row.hot,
    components,
    sizes,
    modifiers: safeParseJson(row.modifiers_json),
  };
}

function safeParseJson(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapStockMovement(row) {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type,
    quantityChange: row.quantity_change,
    quantityAfter: row.quantity_after,
    reason: row.reason,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
  };
}

function saveSizes(db, productId, sizes) {
  db.prepare('DELETE FROM product_sizes WHERE product_id = ?').run(productId);
  const insertSize = db.prepare(
    'INSERT INTO product_sizes (product_id, name, price, position) VALUES (?, ?, ?, ?)'
  );
  (sizes || []).forEach((s, i) => {
    const name = String(s.name || '').trim();
    if (!name) return;
    insertSize.run(productId, name, parseFloat(s.price) || 0, parseInt(s.position, 10) || i);
  });
}

export default function inventoryRouter(uploadsPath) {
  const router = Router();
  const db = getDb();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsPath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image uploads are allowed'));
      }
      cb(null, true);
    },
  });

  router.get('/products', asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM products ORDER BY name').all();
    res.json(rows.map((r) => mapProductWithComponents(r, db)));
  }));

  router.get('/product/:productId', asyncHandler(async (req, res) => {
    const row = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(parseInt(req.params.productId, 10));
    res.json(mapProductWithComponents(row, db));
  }));

  router.post('/product/sku', asyncHandler(async (req, res) => {
    const sku = req.body?.skuCode;
    const row = db
      .prepare('SELECT * FROM products WHERE id = ? OR name = ?')
      .get(parseInt(sku, 10) || -1, String(sku || ''));
    res.json(mapProductWithComponents(row, db));
  }));

  router.post(
    '/product',
    requirePerm('perm_products'),
    upload.single('imagename'),
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      let image = body.img || '';

      if (req.file) {
        image = req.file.filename;
      }

      if (String(body.remove) === '1' && body.img) {
        const oldPath = path.join(uploadsPath, body.img);
try {
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          } catch (err) {
            logger.error({ err: err.message }, 'Failed to delete old product image');
          }
        if (!req.file) image = '';
      }

      const stock = body.stock === 'on' || body.stock === 0 || body.stock === '0' ? 0 : 1;
      const quantity = body.quantity === '' || body.quantity == null ? 0 : parseInt(body.quantity, 10);
      const cost = body.cost === '' || body.cost == null ? 0 : parseFloat(body.cost) || 0;
      const price = body.price === '' || body.price == null ? 0 : parseFloat(body.price) || 0;
      if (price < 0 || cost < 0) {
        return res.status(400).json({ error: 'Price and cost cannot be negative' });
      }

      let components = [];
      if (body.components) {
        try {
          components = JSON.parse(body.components);
        } catch {
          components = [];
        }
      }

      let sizes = [];
      if (body.sizes) {
        try {
          sizes = JSON.parse(body.sizes);
        } catch {
          sizes = [];
        }
      }

      let modifiers = [];
      if (body.modifiers) {
        try {
          modifiers = JSON.parse(body.modifiers);
        } catch {
          modifiers = [];
        }
      }

      const hot = body.hot === '1' || body.hot === 1 || body.hot === true || body.hot === 'true' ? 1 : 0;

      if (!body.id) {
        // Resolve category_id from category name or use provided category_id
        let categoryId = body.category_id ? parseInt(body.category_id, 10) : null;
        if (!categoryId && body.category) {
          const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(body.category);
          if (cat) categoryId = cat.id;
        }

        const result = db
          .prepare(
            `INSERT INTO products (name, price, cost, category, category_id, quantity, stock, img, variants_json, modifiers_json, hot)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            body.name,
            price,
            cost,
            body.category || '',
            categoryId,
            quantity,
            stock,
            image,
            '[]',
            JSON.stringify(modifiers),
            hot
          );
        const productId = result.lastInsertRowid;

        // Save components
        if (components.length > 0) {
          const insertComp = db.prepare(
            'INSERT INTO product_components (parent_product_id, component_product_id, quantity) VALUES (?, ?, ?)'
          );
          for (const comp of components) {
            insertComp.run(productId, comp.id, comp.quantity || 1);
          }
        }

        saveSizes(db, productId, sizes);

        const row = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        const authUser = req.user || {};
        auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'create', 'product', productId, null, row);
        return res.json(mapProductWithComponents(row, db));
      }

      const id = parseInt(body.id, 10);
      // Resolve category_id from category name or use provided category_id
      let categoryId = body.category_id ? parseInt(body.category_id, 10) : null;
      if (!categoryId && body.category) {
        const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(body.category);
        if (cat) categoryId = cat.id;
      }

      db.prepare(
        `UPDATE products SET name = ?, price = ?, cost = ?, category = ?, category_id = ?, quantity = ?, stock = ?, img = ?, variants_json = ?, modifiers_json = ?, hot = ?
         WHERE id = ?`
      ).run(
        body.name,
        price,
        cost,
        body.category || '',
        categoryId,
        quantity,
        stock,
        image,
        '[]',
        JSON.stringify(modifiers),
        hot,
        id
      );

      // Update components: delete old, insert new
      db.prepare('DELETE FROM product_components WHERE parent_product_id = ?').run(id);
      if (components.length > 0) {
        const insertComp = db.prepare(
          'INSERT INTO product_components (parent_product_id, component_product_id, quantity) VALUES (?, ?, ?)'
        );
        for (const comp of components) {
          insertComp.run(id, comp.id, comp.quantity || 1);
        }
      }

      saveSizes(db, id, sizes);

      const updatedRow = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      const authUser = req.user || {};
      auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'update', 'product', id, { id }, updatedRow);
      res.sendStatus(200);
    }
  ));

  router.post(
    '/product/:productId/hot',
    requirePerm('perm_products'),
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.productId, 10);
      const hot = req.body?.hot ? 1 : 0;
      const db = getDb();
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!row) return res.sendStatus(404);
      db.prepare('UPDATE products SET hot = ? WHERE id = ?').run(hot, id);
      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      const authUser = req.user || {};
      auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'update', 'product', id, { hot: row.hot }, { hot });
      res.json(mapProductWithComponents(updated, db));
    })
  );

router.delete('/product/:productId', requirePerm('perm_products'), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.productId, 10);
    const db = getDb();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (row) {
      const authUser = req.user || {};
      auditLog(db, authUser.id || 0, authUser.fullname || 'Unknown', 'delete', 'product', id, row, null);
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    if (row?.img) {
      const imgPath = path.join(uploadsPath, row.img);
      try {
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
          } catch (err) {
            logger.error({ err: err.message }, 'Failed to delete product image during bulk delete');
          }
    }
    res.sendStatus(200);
  }));

  router.post('/products/bulk-delete', requirePerm('perm_products'), asyncHandler(async (req, res) => {
    const ids = (req.body?.ids || [])
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (!ids.length) {
      return res.status(400).json({ error: 'No product ids provided' });
    }

    const db = getDb();
    let deleted = 0;
    db.transaction(() => {
      const getImg = db.prepare('SELECT img FROM products WHERE id = ?');
      const del = db.prepare('DELETE FROM products WHERE id = ?');
      for (const id of ids) {
        const row = getImg.get(id);
        const result = del.run(id);
        if (result.changes) deleted += 1;
        if (row?.img) {
          const imgPath = path.join(uploadsPath, row.img);
          try {
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
          } catch (err) {
            logger.error({ err: err.message }, 'Failed to delete product image');
          }
        }
      }
    })();

    res.json({ ok: true, deleted });
  }));

  // Stock adjustment (restock/wastage/adjustment)
  router.post(
    '/product/:productId/adjust-stock',
    requirePerm('perm_products'),
    asyncHandler(async (req, res) => {
      const productId = parseInt(req.params.productId, 10);
      const body = req.body || {};
      const type = body.type; // 'restock' | 'wastage' | 'adjustment'
      const quantityChange = parseInt(body.quantityChange, 10);
      const reason = body.reason || '';
      const userId = parseInt(body.userId, 10) || 0;
      const userName = body.userName || '';

      if (!['restock', 'wastage', 'adjustment'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be restock, wastage, or adjustment' });
      }
      if (!Number.isFinite(quantityChange) || quantityChange === 0) {
        return res.status(400).json({ error: 'quantityChange must be a non-zero number' });
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const currentQty = product.quantity || 0;
      const newQty = Math.max(0, currentQty + quantityChange);

      const tx = db.transaction(() => {
        db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newQty, productId);
        db.prepare(
          `INSERT INTO stock_movements (product_id, type, quantity_change, quantity_after, reason, user_id, user_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(productId, type, quantityChange, newQty, reason, userId, userName, new Date().toISOString());
      });
      tx();

      const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      res.json(mapProductWithComponents(updatedProduct, db));
    })
  );

  // Stock movement history for a product
  router.get(
    '/product/:productId/stock-movements',
    requirePerm('perm_products'),
    asyncHandler(async (req, res) => {
      const productId = parseInt(req.params.productId, 10);
      const limit = parseInt(req.query.limit, 10) || 100;
      const offset = parseInt(req.query.offset, 10) || 0;

      const rows = db
        .prepare(
          `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
        .all(productId, limit, offset);

      const total = db.prepare('SELECT COUNT(*) as n FROM stock_movements WHERE product_id = ?').get(productId);

      res.json({ movements: rows.map(mapStockMovement), total: total?.n || 0 });
    })
  );

  // All stock movements (for history view)
  router.get(
    '/stock-movements',
    requirePerm('perm_products'),
    asyncHandler(async (req, res) => {
      const limit = parseInt(req.query.limit, 10) || 100;
      const offset = parseInt(req.query.offset, 10) || 0;
      const productId = req.query.productId ? parseInt(req.query.productId, 10) : null;
      const type = req.query.type;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      let sql = `SELECT sm.*, p.name as product_name FROM stock_movements sm JOIN products p ON p.id = sm.product_id`;
      const params = [];
      const conditions = [];

      if (productId) {
        conditions.push('sm.product_id = ?');
        params.push(productId);
      }
      if (type) {
        conditions.push('sm.type = ?');
        params.push(type);
      }
      if (startDate) {
        conditions.push('sm.created_at >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('sm.created_at <= ?');
        params.push(endDate);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY sm.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = db.prepare(sql).all(...params);

      let countSql = `SELECT COUNT(*) as n FROM stock_movements sm`;
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
      }
      const total = db.prepare(countSql).get(...params.slice(0, -2));

      res.json({ movements: rows.map(mapStockMovement), total: total?.n || 0 });
    })
  );

  return router;
}
