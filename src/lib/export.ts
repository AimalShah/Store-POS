// Offline export helpers. #12 adds xlsx + native save dialogs on top of
// these; reports reuse the same path to push a report out.

import * as XLSX from 'xlsx';
import type { Customer, Product, StockMovement, Transaction } from '../api/client';

function escapeCsv(value: string | number | null | undefined): string {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ];
  return `\ufeff${lines.join('\r\n')}`;
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  downloadFile(filename, buildCsv(headers, rows));
}

const PAYMENT_NAMES: Record<number, string> = { 1: 'Cash', 2: 'Card', 3: 'Mobile Wallet' };

export type ExportRow = Record<string, string | number | null | undefined>;

// Each dataset becomes one sheet in the workbook / one CSV file. The header
// order is fixed from the first row so partial datasets still export cleanly.
export function salesRows(txs: Transaction[]): ExportRow[] {
  return txs.map((t) => ({
    id: t.id,
    ref_number: t.ref_number,
    date: t.date,
    customer: t.customer_name,
    cashier: t.user,
    till: t.till,
    status: t.status === 1 ? 'Paid' : t.status === 0 ? 'Hold' : 'Refund',
    subtotal: Number(t.subtotal || 0),
    discount: Number(t.discount || 0),
    tax: Number(t.tax || 0),
    total: Number(t.total || 0),
    paid: Number(t.paid || 0),
    change: Number(t.change || 0),
    payment: PAYMENT_NAMES[t.payment_type] || t.payment_type,
    items: (t.items || []).reduce((n, i) => n + i.quantity, 0),
  }));
}

export function catalogRows(products: Product[]): ExportRow[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    quantity: p.quantity,
    stock: p.stock,
    low_stock_threshold: p.lowStockThreshold,
  }));
}

export function customerRows(customers: Customer[]): ExportRow[] {
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
  }));
}

export function stockRows(movements: StockMovement[], products: Product[]): ExportRow[] {
  const names = new Map(products.map((p) => [p.id, p.name]));
  return movements.map((m) => ({
    id: m.id,
    product: names.get(m.productId) || String(m.productId),
    product_id: m.productId,
    type: m.type,
    quantity_change: m.quantityChange,
    quantity_after: m.quantityAfter,
    reason: m.reason || '',
    reference_type: m.referenceType || '',
    reference_id: m.referenceId || '',
    user: m.userName,
    created_at: m.createdAt,
  }));
}

export type DatasetSheet = {
  name: string;
  rows: ExportRow[];
};

// Build an xlsx workbook with exactly one sheet per non-empty dataset.
// Returns a Buffer (Node) / Uint8Array that opens in Excel/Numbers.
export function buildWorkbook(sheets: DatasetSheet[]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    if (!sheet.rows.length) continue;
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sheet.rows),
      sheet.name.slice(0, 31)
    );
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}
