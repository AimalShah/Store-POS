import { describe, test, expect } from 'vitest';
import {
  buildSalesReportPdf,
  buildShiftReportPdf,
  buildInvoicePdf,
} from '../src/lib/reportPdf';

const settings = {
  app: 'StorePOS',
  store: 'Bright Bites Cafe',
  address_one: '12 Market St',
  address_two: 'Springfield',
  contact: '555-0100',
  tax: 'TAX-8842',
  symbol: 'Rs',
  percentage: 0,
  charge_tax: false,
  footer: 'Thank you for your business!',
  till: 1,
};

const report = {
  summary: {
    saleCount: 3,
    itemsSold: 7,
    subtotal: 40,
    discount: 5,
    tax: 2,
    totalSales: 37,
  },
  byCategory: [
    { category: 'Drinks', count: 4, revenue: 20 },
    { category: 'Food', count: 3, revenue: 17 },
  ],
  byPaymentMethod: [
    { method: 'cash', count: 2, amount: 25 },
    { method: 'card', count: 1, amount: 12 },
  ],
  bestSellers: [
    { productId: 1, name: 'Cola', quantity: 4, revenue: 20 },
    { productId: 2, name: 'Fries', quantity: 3, revenue: 17 },
  ],
};

function decode(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return s;
}

function assertValidPdf(buf, mustContain) {
  expect(buf).toBeInstanceOf(ArrayBuffer);
  const head = new Uint8Array(buf).slice(0, 5);
  expect(String.fromCharCode(...head)).toBe('%PDF-');
  const text = decode(buf).toLowerCase();
  for (const needle of mustContain) {
    expect(text).toContain(needle.toLowerCase());
  }
}

describe('report PDF generation', () => {
  test('sales report is a valid PDF with the right content', () => {
    const buf = buildSalesReportPdf({
      settings,
      start: '2026-08-01T00:00',
      end: '2026-08-31T23:59',
      report,
    });
    assertValidPdf(buf, [
      'Bright Bites Cafe',
      'Sales Report',
      'Rs37.00',
      'Cola',
      'Drinks',
      'Cash',
      'Best Sellers',
    ]);
  });

  test('empty ranges still produce a valid PDF', () => {
    const empty = {
      summary: {
        saleCount: 0,
        itemsSold: 0,
        subtotal: 0,
        discount: 0,
        tax: 0,
        totalSales: 0,
      },
      byCategory: [],
      byPaymentMethod: [],
      bestSellers: [],
    };
    const buf = buildSalesReportPdf({ settings, report: empty });
    assertValidPdf(buf, ['Sales Report', 'No sales in this range.']);
  });

  test('X shift report is a valid PDF', () => {
    const x = {
      totalSales: 120,
      cashSales: 80,
      cardSales: 40,
      mobileSales: 0,
      saleCount: 10,
      transactionCount: 12,
      refundCount: 1,
      refundTotal: 5,
    };
    const buf = buildShiftReportPdf({
      settings,
      report: x,
      shift: { id: 7, userName: 'Aimal', till: 1, openedAt: '2026-08-14T09:00:00Z' },
      type: 'X',
    });
    assertValidPdf(buf, ['Bright Bites Cafe', 'X Report', 'Shift #7', 'Aimal', 'Rs120.00']);
  });

  test('Z shift report includes cash reconciliation', () => {
    const z = {
      totalSales: 120,
      cashSales: 80,
      cardSales: 40,
      mobileSales: 0,
      saleCount: 10,
      transactionCount: 12,
      refundCount: 1,
      refundTotal: 5,
      expectedCash: 80,
      actualCash: 78,
      difference: -2,
    };
    const buf = buildShiftReportPdf({
      settings,
      report: z,
      shift: {
        id: 7,
        userName: 'Aimal',
        till: 1,
        openedAt: '2026-08-14T09:00:00Z',
        closedAt: '2026-08-14T17:00:00Z',
        floatAmount: 50,
        countedCash: 128,
      },
      type: 'Z',
    });
    assertValidPdf(buf, ['Z Report', 'Cash Reconciliation', 'Rs50.00', 'Difference']);
  });

  test('invoice is a valid PDF with line items', () => {
    const tx = {
      id: 99,
      ref_number: 'INV-99',
      date: '2026-08-14T12:00:00Z',
      customer_name: 'Jane Doe',
      user: 'Administrator',
      fulfillment: 'delivery',
      items: [{ name: 'Cola', quantity: 2, price: 3 }],
      subtotal: 6,
      discount: 1,
      tax: 0.5,
      total: 5.5,
      paid: 6,
      change: 0.5,
      payment_breakdown: [{ method: 'cash', amount: 6 }],
    };
    const buf = buildInvoicePdf({ settings, tx });
    assertValidPdf(buf, [
      'Bright Bites Cafe',
      'Order',
      'Order #099',
      'Cola',
      'Rs5.50',
      'Jane Doe',
      'Cash',
    ]);
  });
});
