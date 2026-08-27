import type {
  ApiInfo,
  DetectedPrinter,
  PosBridge,
  PrintResult,
  SaveFileOptions,
  SaveFileResult,
} from './vite-env';

const FALLBACK_PORT = 8001;

function constantApiInfo(): ApiInfo {
  return {
    baseUrl: `http://127.0.0.1:${FALLBACK_PORT}/api`,
    healthUrl: `http://127.0.0.1:${FALLBACK_PORT}/`,
    till: 1,
  };
}

function decodeBase64(data: string): ArrayBuffer {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function browserFallback(): PosBridge {
  return {
    getApiInfo: async () => constantApiInfo(),
    quit: () => {
      window.close();
    },
    reload: () => {
      window.location.reload();
    },
    saveFile: async ({ defaultName, type, data }: SaveFileOptions): Promise<SaveFileResult> => {
      const mime =
        type === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8';
      const blob = new Blob([decodeBase64(data)], { type: mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = defaultName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return { ok: true, filePath: defaultName };
    },
    printReceipt: async (): Promise<PrintResult> => ({ printed: false, fallback: true }),
    printKot: async (): Promise<PrintResult> => ({ printed: false, fallback: true }),
    printPdf: async (): Promise<{ printed: boolean }> => ({ printed: false }),
    listUsbPrinters: async (): Promise<DetectedPrinter[]> => [],
    onUsbPrinterDetected: () => {},
    updater: {
      getState: async () => ({ status: 'idle', version: null, error: null, dev: true }),
      checkNow: async () => ({ status: 'idle', version: null, error: null, dev: true }),
      download: async () => ({ ok: false, dev: true }),
      restart: async () => ({ ok: false, dev: true }),
      onState: () => {},
    },
  };
}

export function getPosBridge(): PosBridge {
  if (typeof window !== 'undefined' && window.pos) {
    return window.pos;
  }
  return browserFallback();
}

export function isElectronBridge(): boolean {
  return typeof window !== 'undefined' && Boolean(window.pos);
}
