import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb, mapProduct, auditLog } from '../db.js';
import {
  asyncHandler,
  requireManager,
} from '../auth.js';
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
      `SELECT id, name, price, cost, position FROM product_sizes WHERE product_id = ? ORDER BY position, id`
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
    img: row.img,
    hot: !!row.hot,
    components,
    sizes,
    modifiers: safeParseJson(row.modifiers_json),
  };
}

// A Product carries EITHER one base price OR size prices — never both (ADR-0003).
// When sizes exist the base price becomes the cheapest size ("From £X") and the
// base cost is irrelevant because every sold line carries its size's own cost.
function safeParseJson(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSizes(db, productId, sizes) {
  db.prepare('DELETE FROM product_sizes WHERE product_id = ?').run(productId);
  const insertSize = db.prepare(
    'INSERT INTO product_sizes (product_id, name, price, cost, position) VALUES (?, ?, ?, ?, ?)'
  );
  (sizes || []).forEach((s, i) => {
    const name = String(s.name || '').trim();
    if (!name) return;
    const price = parseFloat(s.price) || 0;
    const sizeCost = parseFloat(s.cost) || 0;
    insertSize.run(productId, name, price, sizeCost, parseInt(s.position, 10) || i);
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
    requireManager,
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

      // A Product carries EITHER one base price OR size prices — never both
      // (ADR-0003). With sizes present the base price mirrors the cheapest size
      // ("From £X") and the base cost is cleared; each sold line snapshots its
      // own size's cost.
      let incomingSizes = [];
      if (body.sizes) {
        try {
          incomingSizes = JSON.parse(body.sizes);
        } catch {
          incomingSizes = [];
        }
      }
      const validSizes = incomingSizes.filter((sz) => String(sz.name || '').trim());
      if (validSizes.length) {
        body.price = String(Math.min(...validSizes.map((sz) => parseFloat(sz.price) || 0)));
        body.cost = '0';
      }

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

      // Resolve the chosen Section: prefer the id, fall back to the name.
      // Both columns are written so every surface (till tabs, reports, catalog)
      // keeps a coherent Section value.
      const resolveSection = () => {
        let categoryId = body.category_id ? parseInt(body.category_id, 10) : null;
        let categoryName = '';
        let row = categoryId ? db.prepare('SELECT id, name FROM categories WHERE id = ?').get(categoryId) : null;
        if (!row && body.category) {
          row = db.prepare('SELECT id, name FROM categories WHERE name = ?').get(body.category);
        }
        if (row) {
          categoryId = row.id;
          categoryName = row.name;
        } else {
          // No matching Section: keep any provided legacy name verbatim.
          categoryId = null;
          categoryName = body.category || '';
        }
        return { categoryId, categoryName };
      };

      if (!body.id) {
        const { categoryId, categoryName } = resolveSection();

        const result = db
          .prepare(
            `INSERT INTO products (name, price, cost, category, category_id, quantity, stock, img, variants_json, modifiers_json, hot)
             VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
          )
          .run(
            body.name,
            price,
            cost,
            categoryName,
            categoryId,
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
      const { categoryId, categoryName } = resolveSection();

      db.prepare(
        `UPDATE products SET name = ?, price = ?, cost = ?, category = ?, category_id = ?, img = ?, variants_json = ?, modifiers_json = ?, hot = ?
         WHERE id = ?`
      ).run(
        body.name,
        price,
        cost,
        categoryName,
        categoryId,
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
    requireManager,
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

router.delete('/product/:productId', requireManager, asyncHandler(async (req, res) => {
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

  router.post('/products/bulk-delete', requireManager, asyncHandler(async (req, res) => {
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




  return router;
}
