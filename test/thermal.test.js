import {
  interfaceUri,
  makePrinter,
  printKotJob,
  printReceiptJob,
  readPrinterConfig,
  writeReceipt,
  writeKot,
} from '../electron/thermal.js';
import { bootApp } from './helpers.js';
import net from 'net';

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
    setTextSize: recorder('setTextSize'),
    setTextNormal: recorder('setTextNormal'),
    printImage: async (logoPath) => {
      calls.push(['printImage', logoPath]);
      return Buffer.from([]);
    },
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
    const isWin = process.platform === 'win32';
    expect(interfaceUri({ interface: 'usb', usbDevice: '/dev/usb/lp0' })).toBe(
      isWin ? 'printer:/dev/usb/lp0' : '/dev/usb/lp0'
    );
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
  test('writeReceipt prints the short order number and totals', () => {
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
    expect(printed).toContain('ORDER #001');
    expect(printed).toContain('Burger Bar');
    expect(printed).toContain('TOTAL');
    expect(printed).toContain('cash');
  });

  test('writeReceipt prints selected variants and modifiers on each line (matches the on-screen invoice)', () => {
    const p = fakePrinter();
    writeReceipt(
      p,
      {
        ref_number: 'INV-20240101-002',
        date: '2024-01-01T12:00:00Z',
        items: [
          {
            quantity: 1,
            name: 'Pizza',
            price: 12,
            selectedVariants: [{ group: 'Size', name: 'Large', priceDelta: 3 }],
            selectedModifiers: [{ name: 'Extra cheese', priceDelta: 1.5 }],
          },
        ],
        subtotal: 12,
        discount: 0,
        tax: 0,
        total: 12,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 12 }],
      },
      { store: 'Pizza Bar', symbol: '$' }
    );
    const printed = p.calls.map((c) => c[1]).join(' ');
    expect(printed).toContain('Large');
    expect(printed).toContain('Extra cheese');
  });

  test('writeReceipt prints negative variant deltas as a minus sign, not +-', async () => {
    const p = fakePrinter();
    await writeReceipt(
      p,
      {
        ref_number: 'INV-20240101-002',
        date: '2024-01-01T12:00:00Z',
        items: [
          {
            quantity: 1,
            name: 'Burger',
            price: 5,
            selectedVariants: [{ group: 'Size', name: 'Junior', priceDelta: -2 }],
          },
        ],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 5 }],
      },
      { store: 'Burger Bar', symbol: '$' }
    );
    const printed = p.calls.map((c) => c[1]).join(' ');
    expect(printed).toContain('- Junior (-$2.00)');
    expect(printed).not.toContain('+-');
  });

  test('writeReceipt falls back to a Paid line when there is no payment breakdown', () => {
    const p = fakePrinter();
    writeReceipt(
      p,
      {
        ref_number: 'INV-20240101-003',
        date: '2024-01-01T12:00:00Z',
        items: [{ quantity: 1, name: 'Burger', price: 5 }],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        paid: 5,
        change: 0,
      },
      { store: 'Burger Bar', symbol: '$' }
    );
    const printed = p.calls.map((c) => c[1]).join(' ');
    expect(printed).toContain('Paid');
  });

  test('writeReceipt marks a voided sale so it cannot be mistaken for a valid one', () => {
    const p = fakePrinter();
    writeReceipt(
      p,
      {
        ref_number: 'INV-20240101-004',
        date: '2024-01-01T12:00:00Z',
        status: 2,
        items: [{ quantity: 1, name: 'Burger', price: 5 }],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 5 }],
      },
      { store: 'Burger Bar', symbol: '$' }
    );
    const printed = p.calls.map((c) => c[1]).join(' ');
    expect(printed).toContain('VOIDED');
  });

  test('writeReceipt prints deal/comb components under each item (matches the on-screen invoice)', () => {
    const p = fakePrinter();
    writeReceipt(
      p,
      {
        ref_number: 'INV-20240101-005',
        date: '2024-01-01T12:00:00Z',
        items: [
          {
            quantity: 2,
            name: 'Family Deal',
            price: 20,
            components: [
              { name: 'Chicken Burger', quantity: 1 },
              { name: 'Fries', quantity: 2 },
              { name: 'Cola', quantity: 2 },
            ],
          },
        ],
        subtotal: 40,
        discount: 0,
        tax: 0,
        total: 40,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 40 }],
      },
      { store: 'Burger Bar', symbol: '$' }
    );
    const printed = p.calls.map((c) => c[1]).join(' ');
    expect(printed).toContain('2x Family Deal');
    expect(printed).toContain('- Chicken Burger x1');
    expect(printed).toContain('- Fries x2');
    expect(printed).toContain('- Cola x2');
  });

  test('writeReceipt prints a thank-you footer by default and the store footer when set', () => {
    const defaultP = fakePrinter();
    writeReceipt(
      defaultP,
      {
        ref_number: 'INV-20240101-005',
        date: '2024-01-01T12:00:00Z',
        items: [{ quantity: 1, name: 'Burger', price: 5 }],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 5 }],
      },
      { store: 'Burger Bar', symbol: '$' }
    );
    const defaultFooter = defaultP.calls.map((c) => c[1]).join(' ');
    expect(defaultFooter).toContain('Thank you for your visit!');
    expect(defaultFooter).toContain('Hope to serve you again soon.');

    const customP = fakePrinter();
    writeReceipt(
      customP,
      {
        ref_number: 'INV-20240101-005',
        date: '2024-01-01T12:00:00Z',
        items: [{ quantity: 1, name: 'Burger', price: 5 }],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 5 }],
      },
      { store: 'Burger Bar', symbol: '$', footer: 'Come again!' }
    );
    const customFooter = customP.calls.map((c) => c[1]).join(' ');
    expect(customFooter).toContain('Come again!');
    expect(customFooter).not.toContain('Thank you for your visit!');
  });

  test('writeReceipt prints the store logo image when a path is provided', async () => {
    const p = fakePrinter();
    await writeReceipt(
      p,
      {
        ref_number: 'INV-20240101-006',
        date: '2024-01-01T12:00:00Z',
        items: [{ quantity: 1, name: 'Burger', price: 5 }],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 5 }],
      },
      { store: 'Burger Bar', symbol: '$', img: 'logo.png' },
      { logoPath: '/tmp/opencode/pos-logo.png' }
    );
    const imageCall = p.calls.find((c) => c[0] === 'printImage');
    expect(imageCall).toEqual(['printImage', '/tmp/opencode/pos-logo.png']);
  });

  test('writeReceipt skips the logo image quietly when no path is provided', async () => {
    const p = fakePrinter();
    await writeReceipt(
      p,
      {
        ref_number: 'INV-20240101-007',
        date: '2024-01-01T12:00:00Z',
        items: [{ quantity: 1, name: 'Burger', price: 5 }],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        change: 0,
        payment_breakdown: [{ method: 'cash', amount: 5 }],
      },
      { store: 'Burger Bar', symbol: '$', img: 'logo.png' }
    );
    expect(p.calls.some((c) => c[0] === 'printImage')).toBe(false);
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

  test('writeKot prints the short ORDER # at double size, like the receipt', () => {
    const p = fakePrinter();
    writeKot(p, {
      ref_number: 'INV-40211',
      date: '2024-01-01T12:00:00Z',
      items: [{ quantity: 1, name: 'Pizza', components: [] }],
    });
    const printed = p.calls.map((c) => c[1]).join('');
    expect(printed).toContain('ORDER #211');
    const sizeCall = p.calls.find((c) => c[0] === 'setTextSize');
    expect(sizeCall).toEqual(['setTextSize', 2, 2]);
    expect(p.calls.some((c) => c[0] === 'setTextNormal')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Real ESC/POS over TCP — a mock printer server on localhost accepts the raw
// byte stream exactly like a real network thermal printer on port 9100 would.
// ---------------------------------------------------------------------------

function startMockPrinter() {
  const chunks = [];
  const server = net.createServer((socket) => {
    socket.on('data', (d) => chunks.push(d));
  });
  const started = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
  return {
    port: started,
    async waitForBytes(timeout = 5000) {
      const start = Date.now();
      while (chunks.length === 0 && Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 20));
      }
      return Buffer.concat(chunks);
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const ESC_POS_ESC = 0x1b; // every ESC/POS command byte starts with ESC
const ESC_POS_FULL_CUT = Buffer.from([0x1d, 0x56, 0x00]); // GS V 0 — full cut
const ESC_POS_HW_INIT = Buffer.from([0x1b, 0x40]); // ESC @ — reset printer

const TINY_TX = {
  ref_number: 'INV-THERMAL-1',
  date: '2026-08-15T12:00:00Z',
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
};

const TINY_SETTINGS = { store: 'Burger Bar', symbol: '$' };

describe('Thermal: real ESC/POS stream over TCP', () => {
  test('receipt bytes start with ESC @ init, carry the text, and end with a full cut', async () => {
    const mock = startMockPrinter();
    const res = await printReceiptJob(TINY_TX, TINY_SETTINGS, {
      receipt: { interface: 'network', networkHost: '127.0.0.1', networkPort: await mock.port, width: 58 },
      kot: { interface: '' },
      autoPrintKot: false,
    });
    expect(res).toEqual({ printed: true, fallback: false, kotPrinted: false });

    const buf = await mock.waitForBytes();
    expect(buf.length).toBeGreaterThan(0);
    // The node-thermal-printer stream is pure ESC/POS: it opens with an ESC
    // command and closes with full-cut (GS V 0) followed by printer reset (ESC @).
    expect(buf[0]).toBe(ESC_POS_ESC);
    const text = buf.toString('latin1');
    expect(text).toContain('Burger Bar');
    expect(text).toContain('ORDER #001');
    expect(text).toContain('Burger');
    expect(text).toContain('TOTAL');
    expect(buf.subarray(-5, -2).equals(ESC_POS_FULL_CUT)).toBe(true);
    expect(buf.subarray(-2).equals(ESC_POS_HW_INIT)).toBe(true);
    await mock.close();
  });

  test('KOT bytes go to the configured KOT printer', async () => {
    const mock = startMockPrinter();
    const res = await printKotJob(TINY_TX, {
      kot: {
        interface: 'network',
        networkHost: '127.0.0.1',
        networkPort: await mock.port,
        width: 58,
      },
    });
    expect(res).toEqual({ printed: true, fallback: false });

    const buf = await mock.waitForBytes();
    expect(buf[0]).toBe(ESC_POS_ESC);
    const text = buf.toString('latin1');
    expect(text).toContain('KITCHEN ORDER');
    expect(text).toContain('Burger');
    expect(buf.subarray(-5, -2).equals(ESC_POS_FULL_CUT)).toBe(true);
    await mock.close();
  });

  test('auto-print KOT after the receipt on the KOT interface', async () => {
    const receipt = startMockPrinter();
    const kot = startMockPrinter();
    const res = await printReceiptJob(TINY_TX, TINY_SETTINGS, {
      receipt: {
        interface: 'network',
        networkHost: '127.0.0.1',
        networkPort: await receipt.port,
        width: 58,
      },
      kot: { interface: 'network', networkHost: '127.0.0.1', networkPort: await kot.port, width: 58 },
      autoPrintKot: true,
    }, { printKot: true });
    expect(res.printed).toBe(true);
    expect(res.kotPrinted).toBe(true);

    expect((await receipt.waitForBytes()).toString('latin1')).toContain('ORDER #001');
    expect((await kot.waitForBytes()).toString('latin1')).toContain('KITCHEN ORDER');
    await receipt.close();
    await kot.close();
  });

  test('an unreachable printer falls back to PDF/browser print', async () => {
    // Grab a port that is definitely closed (listen, then close it).
    const probe = net.createServer();
    await new Promise((r) => probe.listen(0, '127.0.0.1', r));
    const deadPort = probe.address().port;
    await new Promise((r) => probe.close(r));

    const res = await printReceiptJob(TINY_TX, TINY_SETTINGS, {
      receipt: { interface: 'network', networkHost: '127.0.0.1', networkPort: deadPort, width: 58 },
      kot: { interface: '' },
      autoPrintKot: false,
    });
    expect(res).toEqual({ printed: false, fallback: true, kotPrinted: false });
  });
});

describe('Thermal: saved settings drive real printing end-to-end', () => {
  test('printer settings persisted via the API produce a real TCP print job', async () => {
    const mock = startMockPrinter();
    await app.client.request('/api/printer/settings', {
      method: 'POST',
      body: JSON.stringify({
        interface: 'network',
        networkHost: '127.0.0.1',
        networkPort: await mock.port,
        width: 58,
      }),
    });

    const config = readPrinterConfig();
    expect(config.receipt.networkHost).toBe('127.0.0.1');
    const res = await printReceiptJob(TINY_TX, TINY_SETTINGS, config);
    expect(res.printed).toBe(true);

    const buf = await mock.waitForBytes();
    expect(buf[0]).toBe(ESC_POS_ESC);
    expect(buf.toString('latin1')).toContain('ORDER #001');
    expect(buf.subarray(-5, -2).equals(ESC_POS_FULL_CUT)).toBe(true);
    await mock.close();
  });
});
