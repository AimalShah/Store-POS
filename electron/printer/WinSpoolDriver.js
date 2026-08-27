import koffi from 'koffi';

const winspool = koffi.load('winspool.drv');

const PRINTER_ENUM_LOCAL = 0x00000080;
const PRINTER_ENUM_CONNECTIONS = 0x00000004;

const PRINTER_INFO_2W = koffi.struct('PRINTER_INFO_2W', {
  pServerName: 'char16*',
  pPrinterName: 'char16*',
  pShareName: 'char16*',
  pPortName: 'char16*',
  pDriverName: 'char16*',
  pComment: 'char16*',
  pLocation: 'char16*',
  pSepFile: 'char16*',
  pPrintProcessor: 'char16*',
  pDatatype: 'char16*',
  pParameters: 'char16*',
  pDevMode: 'void*',
  pSecurityDescriptor: 'void*',
  Attributes: 'uint32',
  Priority: 'uint32',
  DefaultPriority: 'uint32',
  StartTime: 'uint32',
  UntilTime: 'uint32',
  Status: 'uint32',
  cJobs: 'uint32',
  AveragePPM: 'uint32',
});

const DOC_INFO_1W = koffi.struct('DOC_INFO_1W', {
  pDocName: 'char16*',
  pOutputFile: 'char16*',
  pDatatype: 'char16*',
});

const EnumPrintersW = winspool.func(
  'uint32 EnumPrintersW(uint32 Flags, void* Name, uint32 Level, uint8* pPrinterEnum, uint32 cbBuf, uint32* pcbNeeded, uint32* pcReturned)'
);
const GetDefaultPrinterW = winspool.func(
  'int32 GetDefaultPrinterW(char16* pszBuffer, uint32* pcchBuffer)'
);
const OpenPrinterW = winspool.func(
  'int32 OpenPrinterW(char16* pPrinterName, out void** phPrinter, void* pDefault)'
);
const ClosePrinter = winspool.func('int32 ClosePrinter(void* hPrinter)');
const StartDocPrinterW = winspool.func(
  'uint32 StartDocPrinterW(void* hPrinter, uint32 Level, DOC_INFO_1W* pDocInfo)'
);
const StartPagePrinter = winspool.func('int32 StartPagePrinter(void* hPrinter)');
const WritePrinter = winspool.func(
  'int32 WritePrinter(void* hPrinter, void* pBuf, uint32 cbBuf, uint32* pcWritten)'
);
const EndPagePrinter = winspool.func('int32 EndPagePrinter(void* hPrinter)');
const EndDocPrinter = winspool.func('int32 EndDocPrinter(void* hPrinter)');

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
  const bytesNeeded = Uint32Array(1);
  const returned = Uint32Array(1);

  EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, null, 2, null, 0, bytesNeeded, returned);
  if (bytesNeeded[0] === 0) return [];

  const buf = Buffer.alloc(bytesNeeded[0]);
  const ok = EnumPrintersW(
    PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
    null, 2, buf, bytesNeeded[0], bytesNeeded, returned
  );
  if (!ok) return [];

  const structSize = koffi.sizeof(PRINTER_INFO_2W);
  const printers = [];

  for (let i = 0; i < returned[0]; i++) {
    const base = i * structSize;
    const nameOff = Number(buf.readBigUInt64LE(base + 8));
    const status = buf.readUInt32LE(base + 124);
    printers.push({ name: readUtf16Str(buf, nameOff), status, isDefault: false });
  }

  return printers;
}

function getDefaultPrinterName() {
  let size = Uint32Array(1);
  GetDefaultPrinterW(null, size);
  if (size[0] === 0) return '';
  const buf = Buffer.alloc(size[0] * 2);
  const ok = GetDefaultPrinterW(buf, size);
  if (!ok) return '';
  return buf.toString('utf16le').replace(/\0$/, '');
}

function printDirect({ data, printer: printerName, type, success, error }) {
  const handleRef = koffi.alloc('void*');
  const opened = OpenPrinterW(printerName, handleRef, null);
  if (!opened) {
    error(new Error(`Failed to open printer: ${printerName}`));
    return;
  }
  const handle = koffi.decode(handleRef, 'void*');

  try {
    const docInfo = { pDocName: printerName || 'Print Job', pOutputFile: null, pDatatype: type || 'RAW' };
    const jobID = StartDocPrinterW(handle, 1, docInfo);
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
