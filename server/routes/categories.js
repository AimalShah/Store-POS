import { Router } from 'express';
import { getDb, mapCategory } from '../db.js';
import { requirePerm, asyncHandler } from '../auth.js';

const router = Router();

router.get('/all', asyncHandler(async (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(rows.map(mapCategory));
}));

router.post('/category', requirePerm('perm_categories'), asyncHandler(async (req, res) => {
  const name = req.body?.name;
  const icon = req.body?.icon || 'Utensils';
  const color = req.body?.color || 'gray';
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    getDb().prepare('INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)').run(name, icon, color);
    res.sendStatus(200);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    throw err;
  }
}));

router.put('/category', requirePerm('perm_categories'), asyncHandler(async (req, res) => {
  const id = parseInt(req.body?.id ?? req.body?._id, 10);
  const name = req.body?.name;
  const icon = req.body?.icon || 'Utensils';
  const color = req.body?.color || 'gray';
  try {
    getDb().prepare('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?').run(name, icon, color, id);
    res.sendStatus(200);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    throw err;
  }
}));

router.delete('/category/:categoryId', requirePerm('perm_categories'), asyncHandler(async (req, res) => {
  // ON DELETE SET NULL on category_id FK will handle setting products' category_id to NULL
  getDb()
    .prepare('DELETE FROM categories WHERE id = ?')
    .run(parseInt(req.params.categoryId, 10));
  res.sendStatus(200);
}));

export default router;
