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
});
