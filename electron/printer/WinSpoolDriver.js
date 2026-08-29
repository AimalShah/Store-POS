import koffi from 'koffi';
import logger from '../../server/logger.js';

const isWin = process.platform === 'win32';
const DEBUG_TAG = '[PRINTER-DEBUG-7f3c]';

const PRINTER_ENUM_LOCAL = 0x00000080;
const PRINTER_ENUM_CONNECTIONS = 0x00000004;
const PRINTER_INFO_2_SIZE = 136;
// PRINTER_INFO_4W: pPrinterName (8) + pServerName (8) + Attributes (4, padded
// to 8 for array alignment) = 24 bytes on 64-bit Windows.
const PRINTER_INFO_4_SIZE = 24;

let EnumPrintersW, GetDefaultPrinterW, OpenPrinterW, ClosePrinter;
let StartDocPrinterW, StartPagePrinter, WritePrinter, EndPagePrinter, EndDocPrinter;
let GetLastError;

if (isWin) {
  const winspool = koffi.load('winspool.drv');
  const kernel32 = koffi.load('kernel32.dll');

  GetLastError = kernel32.func('uint32 GetLastError()');

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

  logger.info({ platform: process.platform, arch: process.arch, napi: process.versions.napi },
    `${DEBUG_TAG} Windows spooler driver initialized`);
}

function lastError() {
  return GetLastError ? GetLastError() : null;
}

function spoolerError(operation, message) {
  const win32Error = lastError();
  const err = new Error(`${message} (Win32 error ${win32Error ?? 'unavailable'})`);
  logger.error({ operation, win32Error, err: { message: err.message, stack: err.stack } },
    `${DEBUG_TAG} Windows spooler call failed`);
  return err;
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

// PRINTER_INFO_2W stores pointers to strings, not offsets within the output
// buffer. EnumPrintersW writes those pointers relative to the address of the
// buffer that we supplied. Convert them before reading so 64-bit Windows
// printer queues are not silently dropped.
export function decodePrinterInfo2(buffer, count, bufferAddress) {
  const printers = [];
  for (let i = 0; i < count; i++) {
    const base = i * PRINTER_INFO_2_SIZE;
    const namePointer = buffer.readBigUInt64LE(base + 8);
    const nameOffset = Number(namePointer - bufferAddress);
    const name = readUtf16Str(buffer, nameOffset);
    if (!name) continue;
    printers.push({
      name,
      // On 64-bit Windows, Status follows the security descriptor at byte 120.
      status: buffer.readUInt32LE(base + 120),
      isDefault: false,
    });
  }
  return printers;
}

// PRINTER_INFO_4W only carries name/server/attributes, so the spooler can
// answer without opening a handle to each individual printer. Level 2
// (PRINTER_INFO_2) requires opening every printer to fill in the extra
// fields, and silently drops any printer the caller's process token doesn't
// have Administer rights on — that lookup failure never surfaces as a
// EnumPrintersW error, it just vanishes from the results (success + empty
// buffer). Level 4 is the level Windows itself uses for cheap name listing,
// so it's the reliable one to enumerate with.
function decodePrinterInfo4(buffer, count, bufferAddress) {
  const printers = [];
  for (let i = 0; i < count; i++) {
    const base = i * PRINTER_INFO_4_SIZE;
    const namePointer = buffer.readBigUInt64LE(base);
    const nameOffset = Number(namePointer - bufferAddress);
    const name = readUtf16Str(buffer, nameOffset);
    if (!name) continue;
    printers.push({ name, status: 0, isDefault: false });
  }
  return printers;
}

function getPrinters() {
  if (!isWin) return [];

  const bytesNeeded = new Uint32Array(1);
  const returned = new Uint32Array(1);

  const flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
  const sized = EnumPrintersW(flags, null, 4, null, 0, bytesNeeded, returned);
  logger.debug({ flags, sized, bytesNeeded: bytesNeeded[0], returned: returned[0], win32Error: lastError() },
    `${DEBUG_TAG} EnumPrintersW buffer-size query completed`);
  if (bytesNeeded[0] === 0) {
    logger.warn({ flags, win32Error: lastError() }, `${DEBUG_TAG} Printer enumeration returned no buffer`);
    return [];
  }

  const buf = Buffer.alloc(bytesNeeded[0]);
  const ok = EnumPrintersW(
    flags,
    null, 4, buf, bytesNeeded[0], bytesNeeded, returned
  );
  if (!ok) {
    spoolerError('EnumPrintersW', 'Failed to enumerate Windows printer queues');
    return [];
  }

  const defaultName = getDefaultPrinterName();
  const printers = decodePrinterInfo4(buf, returned[0], koffi.address(buf)).map((printer) => ({
    ...printer,
    isDefault: printer.name === defaultName,
  }));
  logger.info({ count: printers.length, defaultName, printers }, `${DEBUG_TAG} Windows printer queues enumerated`);
  return printers;
}

function getDefaultPrinterName() {
  if (!isWin) return '';

  let size = new Uint32Array(1);
  const sized = GetDefaultPrinterW(null, size);
  logger.debug({ sized, charactersNeeded: size[0], win32Error: lastError() },
    `${DEBUG_TAG} Default-printer buffer-size query completed`);
  if (size[0] === 0) {
    logger.warn({ win32Error: lastError() }, `${DEBUG_TAG} Windows has no default printer`);
    return '';
  }
  const buf = Buffer.alloc(size[0] * 2);
  const ok = GetDefaultPrinterW(buf, size);
  if (!ok) {
    spoolerError('GetDefaultPrinterW', 'Failed to read the default printer name');
    return '';
  }
  const name = buf.toString('utf16le').replace(/\0$/, '');
  logger.info({ name }, `${DEBUG_TAG} Default Windows printer resolved`);
  return name;
}

export function buildDocInfo1W(printerName, typeName) {
  const docNameBuf = Buffer.from((printerName || 'Print Job') + '\0', 'utf16le');
  const typeBuf = Buffer.from((typeName || 'RAW') + '\0', 'utf16le');

  const structSize = 24;
  const docNameOffset = structSize;
  const typeOffset = structSize + docNameBuf.length;
  const totalSize = typeOffset + typeBuf.length;

  const buf = Buffer.alloc(totalSize);
  docNameBuf.copy(buf, docNameOffset);
  typeBuf.copy(buf, typeOffset);

  const bufferAddress = koffi.address(buf);
  const docNamePtr = bufferAddress + BigInt(docNameOffset);
  const typePtr = bufferAddress + BigInt(typeOffset);

  buf.writeBigUInt64LE(docNamePtr, 0);
  buf.writeBigUInt64LE(0n, 8);
  buf.writeBigUInt64LE(typePtr, 16);

  return buf;
}

function printDirect({ data, printer: printerName, type, success, error }) {
  if (!isWin) {
    logger.error({ printerName, type }, `${DEBUG_TAG} Raw print requested outside Windows`);
    error(new Error('PrintDirect is only supported on Windows'));
    return;
  }

  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const startedAt = Date.now();
  logger.info({ printerName, type, bytes: dataBuf.length }, `${DEBUG_TAG} Starting raw Windows print job`);

  const handleBuf = Buffer.alloc(8);
  const opened = OpenPrinterW(printerName, handleBuf, null);
  if (!opened) {
    error(spoolerError('OpenPrinterW', `Failed to open printer: ${printerName}`));
    return;
  }
  const handle = handleBuf.readBigUInt64LE(0);
  logger.info({ printerName, handle: `0x${handle.toString(16)}` }, `${DEBUG_TAG} Printer queue opened`);

  try {
    const docInfoBuf = buildDocInfo1W(printerName, type);
    const jobID = StartDocPrinterW(handle, 1, docInfoBuf);
    if (!jobID) {
      error(spoolerError('StartDocPrinterW', 'Failed to start Windows print document'));
      return;
    }
    logger.info({ printerName, jobID }, `${DEBUG_TAG} Windows print document started`);

    if (!StartPagePrinter(handle)) {
      error(spoolerError('StartPagePrinter', 'Failed to start Windows print page'));
      return;
    }
    logger.debug({ printerName, jobID }, `${DEBUG_TAG} Windows print page started`);
    const written = new Uint32Array(1);
    if (!WritePrinter(handle, dataBuf, dataBuf.length, written)) {
      error(spoolerError('WritePrinter', 'Failed to write raw print data to Windows spooler'));
      return;
    }
    logger.info({ printerName, jobID, expectedBytes: dataBuf.length, writtenBytes: written[0] },
      `${DEBUG_TAG} Raw print data written to Windows spooler`);
    if (written[0] !== dataBuf.length) {
      const err = new Error(`Windows spooler wrote ${written[0]} of ${dataBuf.length} bytes`);
      logger.error({ printerName, jobID, err: { message: err.message, stack: err.stack } },
        `${DEBUG_TAG} Windows spooler performed a partial write`);
      error(err);
      return;
    }
    if (!EndPagePrinter(handle)) {
      error(spoolerError('EndPagePrinter', 'Failed to end Windows print page'));
      return;
    }
    if (!EndDocPrinter(handle)) {
      error(spoolerError('EndDocPrinter', 'Failed to end Windows print document'));
      return;
    }

    logger.info({ printerName, jobID, durationMs: Date.now() - startedAt },
      `${DEBUG_TAG} Windows print job submitted successfully`);
    success(jobID);
  } catch (err) {
    logger.error({ printerName, type, err: { message: err.message, stack: err.stack } },
      `${DEBUG_TAG} Unexpected raw printing error`);
    error(err);
  } finally {
    const closed = ClosePrinter(handle);
    logger.debug({ printerName, closed, win32Error: closed ? null : lastError() },
      `${DEBUG_TAG} Printer queue closed`);
  }
}

export const winSpoolDriver = { getPrinters, getDefaultPrinterName, printDirect };
