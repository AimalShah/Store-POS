import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db.js';
import { requireAnyPerm } from '../auth.js';

// Deterministic PRNG so seeded data is reproducible across runs.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Two-colour gradient per category, used for the generated product images.
const PALETTE = {
  Pizzas: ['#c0392b', '#e07b54'],
  Burgers: ['#b5462f', '#e07a4f'],
  Chinese: ['#c0392b', '#e0a94e'],
  Soup: ['#c0563b', '#e08a63'],
  Snacks: ['#c98a1f', '#e6b35c'],
  Drinks: ['#1f7ae0', '#5fb0ff'],
  Deals: ['#7a4ea3', '#a975c4'],
};

// Rough cost-of-goods as a fraction of price, per category.
const COST_FACTOR = {
  Pizzas: 0.42,
  Burgers: 0.42,
  Chinese: 0.45,
  Soup: 0.4,
  Snacks: 0.4,
  Drinks: 0.3,
  Deals: 0.6,
};

// On-hand stock range per category [min, max].
const QTY = {
  Pizzas: [30, 55],
  Burgers: [40, 70],
  Chinese: [30, 55],
  Soup: [30, 55],
  Snacks: [60, 110],
  Drinks: [100, 180],
  Deals: [20, 40],
};

// Fast-food catalogue. Each item is [name, prices]: a single number for
// categories without sizes, or an array matched positionally to SIZES[category].
const CATALOG = [
  { c: 'Pizzas', items: [
    ['Margherita', [70, 95, 120]], ['Pepperoni', [85, 115, 145]], ['BBQ Chicken', [90, 120, 150]],
    ['Veggie', [80, 110, 140]], ['Four Cheese', [90, 120, 150]], ['Hawaiian', [85, 115, 145]],
    ['Meat Lovers', [95, 130, 160]],
  ] },
  { c: 'Burgers', items: [
    ['Beef Burger', [55, 70]], ['Cheeseburger', [65, 80]], ['Chicken Burger', [60, 75]],
    ['Veggie Burger', [58, 72]], ['Bacon Burger', [70, 85]], ['Double Beef', [80, 95]],
    ['BBQ Burger', [72, 88]],
  ] },
  { c: 'Chinese', items: [
    ['Sweet & Sour Chicken', [75, 110]], ['Chicken Fried Rice', [60, 90]], ['Beef Chow Mein', [70, 100]],
    ['Kung Pao Chicken', [80, 115]], ['Egg Fried Rice', [50, 75]], ['Vegetable Stir Fry', [65, 95]],
    ['Spring Rolls (4pc)', [30, 50]], ['Prawn Crackers', [22, 38]], ['Sweet & Sour Pork', [80, 115]],
  ] },
  { c: 'Soup', items: [
    ['Tomato Soup', [30, 45]], ['Lentil Soup', [32, 48]], ['Chicken Soup', [35, 50]],
    ['Butternut Soup', [32, 48]], ['Mushroom Soup', [36, 52]],
  ] },
  { c: 'Snacks', items: [
    ['Fries', [25, 38]], ['Cheesy Fries', [32, 45]], ['Onion Rings', [28, 40]],
    ['Chicken Nuggets (6pc)', [35, 50]], ['Mozzarella Sticks', [35, 50]], ['Wedges', [30, 42]],
    ['Garlic Bread', [25, 38]], ['Corn on the Cob', [28, 40]],
  ] },
  { c: 'Drinks', items: [
    ['Cola', [18, 25, 32]], ['Diet Cola', [18, 25, 32]], ['Lemonade', [20, 28, 35]],
    ['Orange Juice', [25, 32, 40]], ['Still Water', [12, 18, 25]], ['Sparkling Water', [14, 20, 28]],
    ['Iced Tea', [20, 28, 35]], ['Energy Drink', [30, 38, 45]], ['Mango Juice', [28, 35, 42]],
  ] },
  { c: 'Deals', items: [
    ['Burger Combo', 95], ['Pizza Combo', 130], ['Family Feast', 280],
    ['Chicken Meal', 110], ['Kids Meal', 55], ['Snack Combo', 70],
  ] },
];

// Size variants per category (null = no sizes).
const SIZES = {
  Pizzas: ['Small', 'Medium', 'Large'],
  Burgers: ['Regular', 'Large'],
  Chinese: ['Regular', 'Large'],
  Soup: ['Cup', 'Bowl'],
  Snacks: ['Regular', 'Large'],
  Drinks: ['Small', 'Medium', 'Large'],
  Deals: null,
};

// Optional "Extras" modifier groups per category (toppings / add-ons).
const TOPPINGS = {
  Pizzas: [
    ['Extra Cheese', 15], ['Olives', 10], ['Mushrooms', 10],
    ['Pepperoni', 18], ['Bacon', 20], ['Chillies', 8],
  ],
  Burgers: [
    ['Extra Patty', 25], ['Cheese', 8], ['Bacon', 15], ['Fried Egg', 10],
  ],
};

// Each catalogue item becomes ONE product. Size becomes rows in product_sizes
// (absolute prices) and the category's toppings become an "Extras" modifier
// group, so the till can offer them in a selection popup.
function buildCatalog() {
  const out = [];
  for (const group of CATALOG) {
    const sizes = SIZES[group.c];
    for (const [name, prices] of group.items) {
      const priceArr = Array.isArray(prices) ? prices : [prices];
      const basePrice = priceArr[0];
      const sizeList = sizes
        ? sizes.map((sz, idx) => ({ name: sz, price: priceArr[idx] }))
        : [];
      const toppingDefs = TOPPINGS[group.c];
      const modifiers = toppingDefs
        ? [{ name: 'Extras', options: toppingDefs.map(([n, d]) => ({ name: n, priceDelta: d })) }]
        : [];
      out.push({ name, price: basePrice, category: group.c, sizes: sizeList, modifiers });
    }
  }
  return out;
}

const DEMO_PRODUCTS = buildCatalog();

const DEMO_CUSTOMERS = [
  { name: 'Thabo Molefe', phone: '082 555 0101', email: 'thabo@example.com', address: 'Sandton' },
  { name: 'Aisha Khan', phone: '083 555 0202', email: 'aisha@example.com', address: 'Cape Town' },
  { name: 'Johan van Wyk', phone: '084 555 0303', email: 'johan@example.com', address: 'Pretoria' },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Lightweight placeholder image: gradient + initial + name. No network needed.
function productSvg(name, palette) {
  const [a, b] = palette || ['#64748b', '#94a3b8'];
  const letter = (name.trim()[0] || '?').toUpperCase();
  const short = name.length > 22 ? `${name.slice(0, 21)}…` : name;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
  </linearGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <circle cx="200" cy="165" r="95" fill="rgba(255,255,255,0.16)"/>
  <text x="200" y="208" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="130" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(letter)}</text>
  <text x="200" y="332" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="27" font-weight="600" fill="#ffffff" text-anchor="middle">${escapeXml(short)}</text>
</svg>`;
}

// Build a single sale's line items, snapshotting cost + categoryId.
function buildSaleItems(productRows, catIdByName, rng) {
  const numItems = 1 + Math.floor(rng() * 4);
  const items = [];
  let subtotal = 0;
  for (let i = 0; i < numItems; i++) {
    const p = productRows[Math.floor(rng() * productRows.length)];
    const qty = 1 + Math.floor(rng() * 3);
    subtotal += p.price * qty;
    items.push({
      id: p.id,
      name: p.name,
      price: p.price,
      quantity: qty,
      cost: p.cost,
      categoryId: catIdByName.get(p.category) || 0,
    });
  }
  return { items, subtotal };
}

function generateSales(db, productRows, catIdByName, rng, now) {
  const insert = db.prepare(
    `INSERT INTO transactions (
       ref_number, customer, customer_name, status, user_id, user_name, till,
       discount, subtotal, tax, total, paid, change, payment_type, payment_breakdown_json, items_json, date
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let salesCount = 0;
  for (let day = 89; day >= 0; day--) {
    const dateBase = new Date(now.getTime() - day * 86400000);
    const weekend = dateBase.getDay() === 0 || dateBase.getDay() === 6;
    const ordersToday = weekend
      ? 12 + Math.floor(rng() * 16)
      : 8 + Math.floor(rng() * 12);

    for (let o = 0; o < ordersToday; o++) {
      const { items, subtotal } = buildSaleItems(productRows, catIdByName, rng);
      const total = Math.round(subtotal * 100) / 100;
      const r = rng();
      const method = r < 0.5 ? 'cash' : r < 0.8 ? 'card' : 'mobile';
      const paymentType = method === 'cash' ? 1 : method === 'card' ? 2 : 3;
      const saleDate = new Date(dateBase.getTime() + Math.floor(rng() * 86400000)).toISOString();

      insert.run(
        '',
        '0',
        'Walk-in Customer',
        1,
        1,
        'Administrator',
        1,
        0,
        total,
        0,
        total,
        total,
        0,
        paymentType,
        JSON.stringify([{ method, amount: total }]),
        JSON.stringify(items),
        saleDate
      );
      salesCount++;
    }
  }

  // A few held orders so the Held Orders KPI is populated.
  for (let h = 1; h <= 4; h++) {
    const { items, subtotal } = buildSaleItems(productRows, catIdByName, rng);
    const total = Math.round(subtotal * 100) / 100;
    const saleDate = new Date(now.getTime() - h * 3600000).toISOString();
    insert.run(
      `H-${h}`,
      '0',
      'Walk-in Customer',
      0,
      1,
      'Administrator',
      1,
      0,
      total,
      0,
      total,
      0,
      0,
      1,
      JSON.stringify([{ method: 'cash', amount: total }]),
      JSON.stringify(items),
      saleDate
    );
  }

  return salesCount;
}

// Keyword per category for stock-photo lookups.
const IMAGE_TAGS = {
  Pizzas: 'pizza',
  Burgers: 'burger',
  Chinese: 'noodles',
  Soup: 'soup',
  Snacks: 'fries',
  Drinks: 'soda',
  Deals: 'fastfood',
};

// Download a real stock photo per product (best-effort). Falls back to the
// SVG placeholder when the network is unavailable so seeding never fails.
async function fetchProductImage(p, i, libraryDir) {
  const tag = IMAGE_TAGS[p.category] || 'food';
  const url = `https://loremflickr.com/400/400/${encodeURIComponent(tag)}?lock=${i + 1}`;
  const jpg = path.join(libraryDir, `seed-${i}.jpg`);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 100) throw new Error('empty');
    fs.writeFileSync(jpg, buf);
    p.imgFile = `library/seed-${i}.jpg`;
  } catch {
    fs.writeFileSync(path.join(libraryDir, `seed-${i}.svg`), productSvg(p.name, PALETTE[p.category]));
    p.imgFile = `library/seed-${i}.svg`;
  }
}

async function downloadSeedImages(libraryDir) {
  await Promise.all(DEMO_PRODUCTS.map((p, i) => fetchProductImage(p, i, libraryDir)));
}

export default function demoRouter(uploadsPath) {
  const router = Router();
  const libraryDir = path.join(uploadsPath, 'library');
  fs.mkdirSync(libraryDir, { recursive: true });

  router.post('/seed', requireAnyPerm('perm_products', 'perm_settings'), async (_req, res) => {
    const db = getDb();

    // Fetch real stock photos up-front; the DB work below references them.
    await downloadSeedImages(libraryDir);

    const result = db.transaction(() => {
      let categoriesAdded = 0;
      let productsAdded = 0;
      let customersAdded = 0;
      let salesAdded = 0;
      const rng = mulberry32(20260813);

      // Replace any existing demo data so re-seeding always reflects the latest catalogue.
      db.prepare('DELETE FROM transactions').run();
      db.prepare('DELETE FROM stock_movements').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare("DELETE FROM customers WHERE name != 'Walk-in Customer'").run();

      // Categories.
      for (const group of CATALOG) {
        db.prepare('INSERT INTO categories (name) VALUES (?)').run(group.c);
        categoriesAdded += 1;
      }
      const catRows = db.prepare('SELECT id, name FROM categories').all();
      const catIdByName = new Map(catRows.map((c) => [c.name, c.id]));

      // Products with downloaded stock images + cost + stock + sizes + toppings.
      const insertProduct = db.prepare(
        `INSERT INTO products (name, price, cost, category, quantity, stock, img, variants_json, modifiers_json)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
      );
      const insertSize = db.prepare(
        'INSERT INTO product_sizes (product_id, name, price, position) VALUES (?, ?, ?, ?)'
      );
      DEMO_PRODUCTS.forEach((p, i) => {
        const range = QTY[p.category] || [30, 60];
        const quantity = range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
        const cost = Math.round(p.price * (COST_FACTOR[p.category] || 0.4));
        const pid = insertProduct.run(
          p.name,
          p.price,
          cost,
          p.category,
          quantity,
          p.imgFile || `library/seed-${i}.svg`,
          '[]',
          JSON.stringify(p.modifiers || [])
        ).lastInsertRowid;
        (p.sizes || []).forEach((s, si) => insertSize.run(pid, s.name, s.price, si));
        productsAdded += 1;
      });

      // Customers.
      const insertCustomer = db.prepare(
        'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)'
      );
      for (const c of DEMO_CUSTOMERS) {
        insertCustomer.run(c.name, c.phone, c.email, c.address);
        customersAdded += 1;
      }

      // Historical sales so dashboards and reports have data.
      const productRows = db
        .prepare('SELECT id, name, price, cost, category FROM products')
        .all();
      salesAdded = generateSales(db, productRows, catIdByName, rng, new Date());

      return { categoriesAdded, productsAdded, customersAdded, salesAdded };
    })();

    res.json({
      ok: true,
      ...result,
      message: `Added ${result.productsAdded} products (with images), ${result.categoriesAdded} categories, ${result.customersAdded} customers${
        result.salesAdded ? `, ${result.salesAdded} sales` : ''
      }`,
    });
  });

  router.post('/clear', requireAnyPerm('perm_products', 'perm_settings'), (req, res) => {
    const body = req.body || {};
    const clearProducts = body.products !== false;
    const clearCategories = body.categories !== false;
    const clearCustomers = body.customers !== false;
    const clearTransactions = body.transactions !== false;

    const db = getDb();
    const counts = db.transaction(() => {
      const out = { products: 0, categories: 0, customers: 0, transactions: 0 };
      if (clearTransactions) out.transactions = db.prepare('DELETE FROM transactions').run().changes || 0;
      if (clearProducts) out.products = db.prepare('DELETE FROM products').run().changes || 0;
      if (clearCategories) out.categories = db.prepare('DELETE FROM categories').run().changes || 0;
      if (clearCustomers) {
        out.customers = db.prepare("DELETE FROM customers WHERE name != 'Walk-in Customer'").run().changes || 0;
      }
      return out;
    })();

    res.json({ ok: true, deleted: counts, message: 'Catalog and related demo data cleared' });
  });

  return router;
}
