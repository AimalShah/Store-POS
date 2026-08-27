import koffi from 'koffi';

const isWin = process.platform === 'win32';

const PRINTER_ENUM_LOCAL = 0x00000080;
const PRINTER_ENUM_CONNECTIONS = 0x00000004;
const PRINTER_INFO_2_SIZE = 136;

let EnumPrintersW, GetDefaultPrinterW, OpenPrinterW, ClosePrinter;
let StartDocPrinterW, StartPagePrinter, WritePrinter, EndPagePrinter, EndDocPrinter;

if (isWin) {
  const winspool = koffi.load('winspool.drv');

  EnumPrintersW = winspool.func(
    'uint32 EnumPrintersW(uint32 Flags, void* Name, uint32 Level, uint8* pPrinterEnum, uint32 cbBuf, uint32* pcbNeeded, uint32* pcReturned)'
  );
  GetDefaultPrinterW = winspool.func(
    'int32 GetDefaultPrinterW(char16* pszBuffer, uint32* pcchBuffer)'
  );
  OpenPrinterW = winspool.func(
    'int32 OpenPrinterW(char16* pPrinterName, void** phPrinter, void* pDefault)'
  );
  ClosePrinter = winspool.func('int32 ClosePrinter(void* hPrinter)');
  StartDocPrinterW = winspool.func(
    'uint32 StartDocPrinterW(void* hPrinter, uint32 Level, void* pDocInfo)'
  );
  StartPagePrinter = winspool.func('int32 StartPagePrinter(void* hPrinter)');
  WritePrinter = winspool.func(
    'int32 WritePrinter(void* hPrinter, void* pBuf, uint32 cbBuf, uint32* pcWritten)'
  );
  EndPagePrinter = winspool.func('int32 EndPagePrinter(void* hPrinter)');
  EndDocPrinter = winspool.func('int32 EndDocPrinter(void* hPrinter)');
}

function readUtf16Str(buf, offset) {
  if (offset <= 0 || offset >= buf.length) return '';
  const chars = [];
  for (let i = offset; i < buf.length - 1; i += 2) {
    const ch = buf.readUInt16LE(i);
    if (ch === 0) break;
    chars.push(String.fromCharCode(ch));
  }
  return chars.join('');
}

function getPrinters() {
  if (!isWin) return [];

  const bytesNeeded = new Uint32Array(1);
  const returned = new Uint32Array(1);

  EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, null, 2, null, 0, bytesNeeded, returned);
  if (bytesNeeded[0] === 0) return [];

  const buf = Buffer.alloc(bytesNeeded[0]);
  const ok = EnumPrintersW(
    PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
    null, 2, buf, bytesNeeded[0], bytesNeeded, returned
  );
  if (!ok) return [];

  const printers = [];
  for (let i = 0; i < returned[0]; i++) {
    const base = i * PRINTER_INFO_2_SIZE;
    const nameOff = Number(buf.readBigUInt64LE(base + 8));
    const status = buf.readUInt32LE(base + 124);
    printers.push({ name: readUtf16Str(buf, nameOff), status, isDefault: false });
  }

  return printers;
}

function getDefaultPrinterName() {
  if (!isWin) return '';

  let size = Uint32Array(1);
  GetDefaultPrinterW(null, size);
  if (size[0] === 0) return '';
  const buf = Buffer.alloc(size[0] * 2);
  const ok = GetDefaultPrinterW(buf, size);
  if (!ok) return '';
  return buf.toString('utf16le').replace(/\0$/, '');
}

function buildDocInfo1W(printerName, typeName) {
  const docNameBuf = Buffer.from((printerName || 'Print Job') + '\0', 'utf16le');
  const typeBuf = Buffer.from((typeName || 'RAW') + '\0', 'utf16le');

  const structSize = 24;
  const docNameOffset = structSize;
  const typeOffset = structSize + docNameBuf.length;
  const totalSize = typeOffset + typeBuf.length;

  const buf = Buffer.alloc(totalSize);
  docNameBuf.copy(buf, docNameOffset);
  typeBuf.copy(buf, typeOffset);

  const docNamePtr = BigInt(docNameBuf.buffer.byteOffset + docNameBuf.byteOffset + docNameOffset);
  const typePtr = BigInt(typeBuf.buffer.byteOffset + typeBuf.byteOffset + typeOffset);

  buf.writeBigUInt64LE(docNamePtr, 0);
  buf.writeBigUInt64LE(0n, 8);
  buf.writeBigUInt64LE(typePtr, 16);

  return buf;
}

function printDirect({ data, printer: printerName, type, success, error }) {
  if (!isWin) {
    error(new Error('PrintDirect is only supported on Windows'));
    return;
  }

  const handleBuf = Buffer.alloc(8);
  const opened = OpenPrinterW(printerName, handleBuf, null);
  if (!opened) {
    error(new Error(`Failed to open printer: ${printerName}`));
    return;
  }
  const handle = handleBuf.readBigUInt64LE(0);

  try {
    const docInfoBuf = buildDocInfo1W(printerName, type);
    const jobID = StartDocPrinterW(handle, 1, docInfoBuf);
    if (!jobID) {
      error(new Error('StartDocPrinter failed'));
      return;
    }

    StartPagePrinter(handle);
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const written = Uint32Array(1);
    WritePrinter(handle, dataBuf, dataBuf.length, written);
    EndPagePrinter(handle);
    EndDocPrinter(handle);

    success(jobID);
  } catch (err) {
    error(err);
  } finally {
    ClosePrinter(handle);
  }
}

export const winSpoolDriver = { getPrinters, getDefaultPrinterName, printDirect };
