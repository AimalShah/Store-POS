import { describe, expect, test } from 'vitest';
import koffi from 'koffi';
import { buildDocInfo1W, decodePrinterInfo2 } from '../electron/printer/WinSpoolDriver.js';

describe('Windows spooler printer discovery', () => {
  test('resolves PRINTER_INFO_2W name pointers relative to the output buffer', () => {
    const bufferAddress = 0x10000000n;
    const nameOffset = 136;
    const buffer = Buffer.alloc(nameOffset + 64);
    buffer.writeBigUInt64LE(bufferAddress + BigInt(nameOffset), 8);
    buffer.writeUInt32LE(0x80, 120);
    Buffer.from('POS-80C\0', 'utf16le').copy(buffer, nameOffset);

    expect(decodePrinterInfo2(buffer, 1, bufferAddress)).toEqual([
      { name: 'POS-80C', status: 0x80, isDefault: false },
    ]);
  });

  test('builds DOC_INFO_1W with pointers into its live buffer', () => {
    const docInfo = buildDocInfo1W('Store POS Receipt', 'RAW');
    const address = koffi.address(docInfo);
    const docNameBytes = Buffer.from('Store POS Receipt\0', 'utf16le');

    expect(docInfo.readBigUInt64LE(0)).toBe(address + 24n);
    expect(docInfo.readBigUInt64LE(16)).toBe(address + BigInt(24 + docNameBytes.length));
  });
});
