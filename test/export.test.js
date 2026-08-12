import * as XLSX from 'xlsx';
import {
  buildCsv,
  buildWorkbook,
  salesRows,
  catalogRows,
  customerRows,
  stockRows,
} from '../src/lib/export';

describe('Export: CSV building', () => {
  test('joins headers and rows with BOM and RFC-4180 escaping', () => {
    const csv = buildCsv(['name', 'note'], [['Cola', 'no "ice"']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"no ""ice"""');
    expect(csv.split('\r\n').length).toBe(2); // header + 1 row
  });
});

describe('Export: xlsx workbook with one sheet per dataset', () => {
  test('creates a named sheet per dataset and round-trips the data', () => {
    const buf = buildWorkbook([
      { name: 'Sales', rows: salesRows([{ id: 1, ref_number: 'INV-1', date: '2024-01-01', customer_name: 'A', user: 'admin', till: 1, status: 1, subtotal: 5, discount: 0, tax: 0, total: 5, paid: 5, change: 0, payment_type: 1, items: [] }]) },
      { name: 'Catalog', rows: catalogRows([{ id: 2, name: 'Fries', category: 'Food', price: 3, quantity: 10, stock: 1, lowStockThreshold: 5 }]) },
    ]);

    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Sales', 'Catalog']);

    const sales = XLSX.utils.sheet_to_json(wb.Sheets['Sales']);
    expect(sales[0].ref_number).toBe('INV-1');
    expect(sales[0].total).toBe(5);

    const catalog = XLSX.utils.sheet_to_json(wb.Sheets['Catalog']);
    expect(catalog[0].name).toBe('Fries');
  });

  test('skips empty datasets (no sheet for an empty export)', () => {
    const buf = buildWorkbook([
      { name: 'Customers', rows: [] },
      { name: 'Sales', rows: salesRows([{ id: 1, ref_number: 'INV-1', date: '', customer_name: 'A', user: 'admin', till: 1, status: 1, subtotal: 5, discount: 0, tax: 0, total: 5, paid: 5, change: 0, payment_type: 1, items: [] }]) },
    ]);
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Sales']);
  });
});

describe('Export: row builders map domain entities to flat rows', () => {
  test('salesRows flattens items count and payment name', () => {
    const rows = salesRows([
      { id: 7, ref_number: 'INV-7', date: '', customer_name: 'Walk-in', user: 'admin', till: 1, status: 1, subtotal: 4, discount: 0, tax: 0, total: 4, paid: 4, change: 0, payment_type: 3, items: [{ quantity: 2 }, { quantity: 1 }] },
    ]);
    expect(rows[0].payment).toBe('Mobile Wallet');
    expect(rows[0].items).toBe(3);
  });

  test('customerRows and stockRows keep their columns', () => {
    const c = customerRows([{ id: 1, name: 'Jo', phone: '1', email: 'a@b.c', address: 'St' }]);
    expect(c[0]).toEqual({ id: 1, name: 'Jo', phone: '1', email: 'a@b.c', address: 'St' });

    const s = stockRows(
      [{ id: 9, productId: 2, type: 'sale', quantityChange: -1, quantityAfter: 9, reason: 'Sale', referenceType: 'transaction', referenceId: 7, userName: 'admin', createdAt: 't' }],
      [{ id: 2, name: 'Fries' }]
    );
    expect(s[0].product).toBe('Fries');
    expect(s[0].quantity_change).toBe(-1);
  });
});
