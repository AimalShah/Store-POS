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
  Coffee: ['#6f4e37', '#a9745b'],
  Tea: ['#3f7d5b', '#7fbf9a'],
  'Cold Drinks': ['#1f7ae0', '#5fb0ff'],
  Breakfast: ['#e0a32e', '#f4c869'],
  Burgers: ['#b5462f', '#e07a4f'],
  'Wraps & Sandwiches': ['#c2772b', '#e0a94e'],
  Pizza: ['#c0392b', '#e07b54'],
  Pasta: ['#d98a2b', '#f0b65a'],
  Mains: ['#7a4ea3', '#a975c4'],
  Salads: ['#3a9d4e', '#79c98c'],
  Sides: ['#c98a1f', '#e6b35c'],
  Desserts: ['#a8326b', '#d36c9b'],
  Bakery: ['#b9762e', '#e0a85c'],
  'Ice Cream': ['#e06a9c', '#f4a3c4'],
  Soups: ['#c0563b', '#e08a63'],
  'Kids Menu': ['#2f8fae', '#5fb6cf'],
};

// Rough cost-of-goods as a fraction of price, per category.
const COST_FACTOR = {
  Coffee: 0.22,
  Tea: 0.25,
  'Cold Drinks': 0.3,
  Breakfast: 0.42,
  Burgers: 0.42,
  'Wraps & Sandwiches': 0.45,
  Pizza: 0.42,
  Pasta: 0.4,
  Mains: 0.5,
  Salads: 0.42,
  Sides: 0.4,
  Desserts: 0.38,
  Bakery: 0.35,
  'Ice Cream': 0.3,
  Soups: 0.4,
  'Kids Menu': 0.45,
};

// On-hand stock range per category [min, max].
const QTY = {
  Coffee: [80, 140],
  Tea: [80, 140],
  'Cold Drinks': [100, 180],
  Breakfast: [30, 60],
  Burgers: [40, 70],
  'Wraps & Sandwiches': [40, 70],
  Pizza: [30, 55],
  Pasta: [30, 55],
  Mains: [25, 50],
  Salads: [30, 55],
  Sides: [60, 110],
  Desserts: [30, 55],
  Bakery: [40, 80],
  'Ice Cream': [50, 90],
  Soups: [30, 55],
  'Kids Menu': [30, 55],
};

// Plain café catalogue: [name, price]. No marketing copy.
const CATALOG = [
  { c: 'Coffee', items: [
    ['Espresso', 25], ['Americano', 32], ['Cappuccino', 38], ['Latte', 42],
    ['Flat White', 44], ['Mocha', 45], ['Macchiato', 40], ['Cortado', 36],
  ] },
  { c: 'Tea', items: [
    ['English Breakfast Tea', 28], ['Earl Grey Tea', 28], ['Green Tea', 28],
    ['Rooibos Tea', 26], ['Peppermint Tea', 28], ['Chai Tea', 30], ['Lemon Ginger Tea', 30],
  ] },
  { c: 'Cold Drinks', items: [
    ['Cola', 22], ['Diet Cola', 22], ['Lemonade', 25], ['Orange Juice', 30],
    ['Apple Juice', 28], ['Iced Tea', 25], ['Sparkling Water', 18], ['Still Water', 15],
    ['Energy Drink', 35], ['Granadilla Juice', 32], ['Ginger Beer', 26], ['Mango Juice', 32],
  ] },
  { c: 'Breakfast', items: [
    ['English Breakfast', 75], ['Boerie Roll', 55], ['French Toast', 48], ['Omelette & Toast', 52],
    ['Pancakes', 46], ['Granola Bowl', 50], ['Croissant Plate', 38], ['Breakfast Wrap', 54],
    ['Eggs Benedict', 68], ['Fruit Salad', 42], ['Bagel & Cream Cheese', 44], ['Waffles', 50],
  ] },
  { c: 'Burgers', items: [
    ['Beef Burger', 65], ['Cheeseburger', 75], ['Chicken Burger', 70], ['Veggie Burger', 68],
    ['Bacon Burger', 82], ['Double Beef Burger', 95], ['Slider (3pc)', 88], ['BBQ Burger', 85],
  ] },
  { c: 'Wraps & Sandwiches', items: [
    ['Chicken Wrap', 60], ['Beef Wrap', 65], ['Falafel Wrap', 55], ['Club Sandwich', 62],
    ['Ham & Cheese Sandwich', 48], ['BLT Sandwich', 52], ['Tuna Sandwich', 50], ['Veggie Sandwich', 46],
  ] },
  { c: 'Pizza', items: [
    ['Margherita Pizza', 90], ['Pepperoni Pizza', 110], ['BBQ Chicken Pizza', 120], ['Veggie Pizza', 105],
    ['Four Cheese Pizza', 115], ['Hawaiian Pizza', 108], ['Meat Lovers Pizza', 125],
  ] },
  { c: 'Pasta', items: [
    ['Spaghetti Bolognese', 85], ['Penne Arrabiata', 82], ['Fettuccine Alfredo', 95],
    ['Lasagne', 98], ['Mac & Cheese', 78], ['Carbonara', 96],
  ] },
  { c: 'Mains', items: [
    ['Grilled Chicken', 95], ['Beef Stew', 110], ['Fish & Chips', 90], ['Chicken Curry & Rice', 98],
    ['Vegetable Stir Fry', 85], ['Steak & Chips', 140], ['Lamb Chops', 150], ['Pork Ribs', 120],
    ['Chicken Schnitzel', 88], ['Bobotie', 92], ['Vegetable Curry', 86], ['Bunny Chow', 90], ['Roast Of The Day', 105],
  ] },
  { c: 'Salads', items: [
    ['Greek Salad', 58], ['Caesar Salad', 72], ['Garden Salad', 50], ['Quinoa Salad', 64],
    ['Caprese Salad', 66], ['Beetroot Salad', 56], ['Pasta Salad', 54],
  ] },
  { c: 'Sides', items: [
    ['Fries', 32], ['Cheesy Fries', 40], ['Onion Rings', 30], ['Garlic Bread', 28], ['Coleslaw', 26],
    ['Mozzarella Sticks', 38], ['Wedges', 34], ['Corn on the Cob', 28], ['Bread Roll', 15],
    ['Sweet Potato Fries', 36], ['Peri Peri Fries', 38], ['Dinner Rolls', 22],
  ] },
  { c: 'Desserts', items: [
    ['Chocolate Cake', 40], ['Cheesecake', 45], ['Malva Pudding', 42], ['Brownie', 38], ['Tiramisu', 48],
    ['Creme Brulee', 52], ['Ice Cream Sundae', 45], ['Trifle', 44], ['Apple Crumble', 40], ['Donut', 25],
    ['Chocolate Mousse', 42], ['Cake Slice', 38],
  ] },
  { c: 'Bakery', items: [
    ['Croissant', 28], ['Butter Croissant', 30], ['Muffin', 25], ['Scone', 26], ['Doughnut', 22],
    ['Bagel', 30], ['Banana Bread', 32], ['Pain au Chocolat', 34], ['Hot Cross Bun', 28],
  ] },
  { c: 'Ice Cream', items: [
    ['Vanilla Ice Cream', 28], ['Chocolate Ice Cream', 28], ['Strawberry Ice Cream', 30],
    ['Mint Choc Ice Cream', 32], ['Cookies & Cream', 32], ['Caramel Ice Cream', 30], ['Salted Caramel', 34],
  ] },
  { c: 'Soups', items: [
    ['Tomato Soup', 38], ['Lentil Soup', 40], ['Chicken Soup', 42], ['Butternut Soup', 40],
    ['Mushroom Soup', 44], ['Minestrone', 42],
  ] },
  { c: 'Kids Menu', items: [
    ['Kids Burger', 45], ['Kids Hotdog', 40], ['Kids Pizza', 50], ['Kids Pasta', 45],
    ['Kids Nuggets', 42], ['Kids Mac & Cheese', 44], ['Kids Mini Breakfast', 48],
  ] },
];

// Drinks get a Large option; ice cream gets a Double option.
const LARGE_CATS = new Set(['Coffee', 'Tea', 'Cold Drinks']);
const DOUBLE_CATS = new Set(['Ice Cream']);

function buildCatalog() {
  const out = [];
  for (const group of CATALOG) {
    for (const [name, price] of group.items) {
      out.push({ name, price, category: group.c });
      if (LARGE_CATS.has(group.c)) {
        out.push({ name: `${name} (Large)`, price: Math.round(price * 1.25), category: group.c });
      }
      if (DOUBLE_CATS.has(group.c)) {
        out.push({ name: `${name} (Double)`, price: Math.round(price + 15), category: group.c });
      }
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

export default function demoRouter(uploadsPath) {
  const router = Router();
  const libraryDir = path.join(uploadsPath, 'library');
  fs.mkdirSync(libraryDir, { recursive: true });

  router.post('/seed', requireAnyPerm('perm_products', 'perm_settings'), (_req, res) => {
    const db = getDb();

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

      // Products with generated images + cost + stock.
      const insertProduct = db.prepare(
        `INSERT INTO products (name, price, cost, category, quantity, stock, img)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      );
      DEMO_PRODUCTS.forEach((p, i) => {
        const range = QTY[p.category] || [30, 60];
        const quantity = range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
        const cost = Math.round(p.price * (COST_FACTOR[p.category] || 0.4));
        const filename = `seed-${i}.svg`;
        fs.writeFileSync(path.join(libraryDir, filename), productSvg(p.name, PALETTE[p.category]));
        insertProduct.run(p.name, p.price, cost, p.category, quantity, `library/${filename}`);
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
