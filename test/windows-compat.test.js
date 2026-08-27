import { describe, test, expect } from 'vitest';
import { interfaceUri, makePrinter } from '../electron/thermal.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Windows is the primary deployment target. These tests pin the Windows-specific
// code paths (USB device naming, ESC/POS column widths, win installer config) so a
// regression is caught even when the suite itself runs on Linux/macOS.

describe('printer interface URI — Windows device naming', () => {
  test('USB maps to the Windows device path (e.g. USB001)', () => {
    const isWin = process.platform === 'win32';
    expect(interfaceUri({ interface: 'usb', usbDevice: 'USB001' })).toBe(
      isWin ? 'printer:USB001' : 'USB001'
    );
  });

  test('network maps to a tcp:// uri with host and port', () => {
    expect(interfaceUri({ interface: 'network', networkHost: '192.168.1.50', networkPort: 9100 })).toBe(
      'tcp://192.168.1.50:9100'
    );
  });

  test('an unconfigured printer yields no URI', () => {
    expect(interfaceUri({ interface: '', usbDevice: '', networkHost: '' })).toBe('');
  });
});

describe('printer selection — ESC/POS column widths', () => {
  test('80mm paper uses 48 columns, 58mm uses 32', () => {
    const wide = makePrinter({ interface: 'network', networkHost: '192.168.1.9', networkPort: 9100, width: 80 });
    const narrow = makePrinter({ interface: 'network', networkHost: '192.168.1.9', networkPort: 9100, width: 58 });
    expect(wide.getWidth()).toBe(48);
    expect(narrow.getWidth()).toBe(32);
  });

  test('an unconfigured printer falls back to null (drives PDF print)', () => {
    expect(makePrinter({ interface: '', networkHost: '', usbDevice: '', width: 58 })).toBeNull();
  });
});

describe('Windows packaging configuration', () => {
  const pkg = JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')
  );

  test('the electron build targets Windows (nsis, x64)', () => {
    expect(pkg.build?.win?.target?.[0]?.target).toBe('nsis');
    expect(pkg.build?.win?.target?.[0]?.arch).toContain('x64');
  });

  test('better-sqlite3 is unpacked so the native module loads on Windows', () => {
    expect(pkg.build?.asarUnpack).toContain('**/node_modules/better-sqlite3/**');
  });
});
