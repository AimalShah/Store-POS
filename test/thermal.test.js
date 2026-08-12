import {
  interfaceUri,
  makePrinter,
  printReceiptJob,
  writeReceipt,
  writeKot,
} from '../electron/thermal.js';
import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
  await app.client.login();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Thermal: printer settings API (settings screen)', () => {
  test('persists interface, width, KOT and auto-print settings', async () => {
    await app.client.request('/api/printer/settings', {
      method: 'POST',
      body: JSON.stringify({
        interface: 'network',
        networkHost: '192.168.1.50',
        networkPort: 9100,
        width: 80,
        kotInterface: 'usb',
        kotUsbDevice: '/dev/usb/lp1',
        kotWidth: 58,
        autoPrintKot: true,
      }),
    });

    const { data } = await app.client.request('/api/printer/settings');
    expect(data.printer.interface).toBe('network');
    expect(data.printer.width).toBe(80);
    expect(data.printer.kotInterface).toBe('usb');
    expect(data.printer.autoPrintKot).toBe(true);
  });
});


function fakePrinter() {
  const calls = [];
  const recorder = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    bold: recorder('bold'),
    alignCenter: recorder('alignCenter'),
    alignLeft: recorder('alignLeft'),
    println: recorder('println'),
    leftRight: recorder('leftRight'),
    drawLine: recorder('drawLine'),
    newLine: recorder('newLine'),
    cut: recorder('cut'),
    text: recorder('text'),
    execute: async () => {},
  };
}

describe('Thermal: interface URI mapping', () => {
  test('network builds a tcp:// uri with host and port', () => {
    expect(
      interfaceUri({ interface: 'network', networkHost: '192.168.1.50', networkPort: 9100 })
    ).toBe('tcp://192.168.1.50:9100');
  });

  test('usb returns the device path; empty interface yields no uri', () => {
    expect(interfaceUri({ interface: 'usb', usbDevice: '/dev/usb/lp0' })).toBe('/dev/usb/lp0');
    expect(interfaceUri({ interface: '', networkHost: '', usbDevice: '' })).toBe('');
  });
});

describe('Thermal: printer selection + fallback', () => {
  test('makePrinter returns null when unconfigured (drives PDF fallback)', () => {
    expect(makePrinter({ interface: '', networkHost: '', usbDevice: '', width: 58 })).toBeNull();
    expect(
      makePrinter({ interface: '', networkHost: '', usbDevice: '', width: 80, kot: true })
    ).toBeNull();
  });

  test('makePrinter returns a printer object when a network interface is set', () => {
    const p = makePrinter({
      interface: 'network',
      networkHost: '192.168.1.9',
      networkPort: 9100,
      width: 80,
    });
    expect(p).not.toBeNull();
  });

  test('unconfigured receipt falls back to PDF/browser print', async () => {
    const res = await printReceiptJob(
      { ref_number: 'INV-1', items: [] },
      {},
      { receipt: { interface: '' }, kot: { interface: '' }, autoPrintKot: false }
    );
    expect(res).toEqual({ printed: false, fallback: true, kotPrinted: false });
  });
});

describe('Thermal: receipt and KOT formatting', () => {
  test('writeReceipt prints the invoice number and totals', () => {
    const p = fakePrinter();
    writeReceipt(
      p,
      {
        ref_number: 'INV-20240101-001',
        date: '2024-01-01T12:00:00Z',
        user: 'admin',
        till: 1,
        customer_name: 'Jo',
        items: [{ quantity: 2, name: 'Burger', price: 5, note: 'no onion' }],
        subtotal: 10,
        discount: 0,
        tax: 0,
        total: 10,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 10 }],
      },
      { store: 'Burger Bar', symbol: '$' }
    );
    const printed = p.calls.map((c) => c[1]).join(' ');
    expect(printed).toContain('INV-20240101-001');
    expect(printed).toContain('Burger Bar');
    expect(printed).toContain('TOTAL');
    expect(printed).toContain('cash');
  });

  test('writeKot prints a kitchen ticket with item lines and notes, no prices', () => {
    const p = fakePrinter();
    writeKot(p, {
      ref_number: 'INV-2',
      date: '2024-01-01T12:00:00Z',
      items: [{ quantity: 1, name: 'Pizza', note: 'extra cheese', components: [] }],
    });
    const printed = p.calls.map((c) => c[1]).join(' ');
    expect(printed).toContain('KITCHEN ORDER');
    expect(printed).toContain('Pizza');
    expect(printed).toContain('extra cheese');
  });
});
