import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb, initDatabase, mapCategory } from '../server/db.js';

describe('category schema migration', () => {
  let tmp;
  let dbPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-category-migration-'));
    dbPath = path.join(tmp, 'pos.sqlite');
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        category_id INTEGER
      );
    `);
    legacyDb.close();
  });

  afterEach(() => {
    getDb().close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('adds icon and color fields to an existing categories table', async () => {
    await initDatabase(dbPath);

    expect(getDb().prepare('PRAGMA table_info(categories)').all().map((column) => column.name)).toEqual(
      expect.arrayContaining(['icon', 'color'])
    );
    expect(() =>
      getDb().prepare('INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)').run('Drinks', 'CupSoda', 'blue')
    ).not.toThrow();
    expect(mapCategory(getDb().prepare('SELECT * FROM categories WHERE name = ?').get('Drinks'))).toMatchObject({
      name: 'Drinks',
      icon: 'CupSoda',
      color: 'blue',
    });
  });

  test('deduplicates existing categories (keeps oldest, reassigns products)', async () => {
    // Create legacy DB with duplicate categories and products assigned to them
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      INSERT INTO categories (id, name) VALUES (1, 'Drinks'), (2, 'Drinks'), (3, 'Food'), (4, 'Food');
      INSERT INTO products (id, name, category, category_id) VALUES 
        (1, 'Cola', 'Drinks', 1),
        (2, 'Sprite', 'Drinks', 2),
        (3, 'Burger', 'Food', 3),
        (4, 'Fries', 'Food', 4);
    `);
    legacyDb.close();

    await initDatabase(dbPath);

    // Should have only 2 categories now (duplicates removed)
    const categories = getDb().prepare('SELECT * FROM categories ORDER BY id').all();
    expect(categories.length).toBe(2);
    
    const names = categories.map(c => c.name).sort();
    expect(names).toEqual(['Drinks', 'Food']);
    
    // The kept category should be the oldest (id 1 for Drinks, id 3 for Food)
    const drinks = categories.find(c => c.name === 'Drinks');
    const food = categories.find(c => c.name === 'Food');
    expect(drinks.id).toBe(1);
    expect(food.id).toBe(3);

    // Products should be reassigned to the kept category ids
    const products = getDb().prepare('SELECT * FROM products ORDER BY id').all();
    expect(products[0].category_id).toBe(1); // Cola -> kept Drinks (id 1)
    expect(products[1].category_id).toBe(1); // Sprite -> kept Drinks (id 1)
    expect(products[2].category_id).toBe(3); // Burger -> kept Food (id 3)
    expect(products[3].category_id).toBe(3); // Fries -> kept Food (id 3)
    
    // Legacy category name field should also be updated
    expect(products[0].category).toBe('Drinks');
    expect(products[1].category).toBe('Drinks');
    expect(products[2].category).toBe('Food');
    expect(products[3].category).toBe('Food');
  });
});

describe('category FK behavior', () => {
  let tmp;
  let dbPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-category-fk-'));
    dbPath = path.join(tmp, 'pos.sqlite');
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL DEFAULT 'Utensils',
        color TEXT NOT NULL DEFAULT 'gray'
      );
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        category TEXT NOT NULL DEFAULT '',
        category_id INTEGER,
        quantity INTEGER NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
    `);
    // Insert test data
    legacyDb.exec(`
      INSERT INTO categories (id, name) VALUES (1, 'Drinks'), (2, 'Food');
      INSERT INTO products (id, name, price, cost, category, category_id, quantity, stock) VALUES 
        (1, 'Cola', 2.0, 1.0, 'Drinks', 1, 10, 0),
        (2, 'Burger', 5.0, 2.0, 'Food', 2, 20, 0);
    `);
    legacyDb.close();
    initDatabase(dbPath);
  });

  afterEach(() => {
    getDb().close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('renaming a category keeps products linked via category_id', async () => {
    const db = getDb();
    
    // Rename "Drinks" to "Beverages"
    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run('Beverages', 1);
    
    // Product should still be linked via category_id
    const products = db.prepare('SELECT * FROM products ORDER BY id').all();
    expect(products[0].category_id).toBe(1); // Still linked to category id 1
    expect(products[0].category).toBe('Drinks'); // Legacy name field unchanged
    
    // Category name is now "Beverages"
    const cat = db.prepare('SELECT * FROM categories WHERE id = 1').get();
    expect(cat.name).toBe('Beverages');
  });

  test('deleting a category sets category_id = NULL on products', async () => {
    const db = getDb();
    
    // Delete the "Drinks" category (id 1)
    db.prepare('DELETE FROM categories WHERE id = ?').run(1);
    
    // Product should have category_id = NULL
    const products = db.prepare('SELECT * FROM products ORDER BY id').all();
    expect(products[0].category_id).toBeNull(); // Cola's category_id set to NULL
    expect(products[1].category_id).toBe(2); // Burger still linked to Food
  });

  test('creating product with category_id links correctly', async () => {
    const db = getDb();
    
    db.prepare(
      'INSERT INTO products (name, price, cost, category, category_id, quantity, stock) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Water', 1.5, 0.5, 'Drinks', 1, 100, 0);
    
    const product = db.prepare('SELECT * FROM products WHERE name = ?').get('Water');
    expect(product.category_id).toBe(1);
    expect(product.category).toBe('Drinks');
  });
});
