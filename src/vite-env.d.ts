/// <reference types="vite/client" />

export type ApiInfo = {
  baseUrl: string;
  healthUrl: string;
  till: number;
};

export type SaveFileOptions = {
  defaultName: string;
  type: 'xlsx' | 'csv';
  data: string;
};

export type SaveFileResult = {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
};

export type PrintResult = {
  printed: boolean;
  fallback: boolean;
  kotPrinted?: boolean;
};

export type ReceiptPrintPayload = {
  tx: {
    ref_number: string;
    date: string;
    user?: string;
    till?: number;
    customer_name?: string;
    subtotal?: number;
    discount?: number;
    tax?: number;
    total?: number;
    change?: number;
    payment_breakdown?: { method: string; amount: number }[];
    items?: { name: string; price: number; quantity: number; note?: string; components?: { name: string; quantity: number }[] }[];
  };
  settings: {
    store?: string;
    address_one?: string;
    address_two?: string;
    contact?: string;
    tax?: string;
    symbol?: string;
    footer?: string;
  };
  printKot?: boolean;
};

export type PosBridge = {
  getApiInfo: () => Promise<ApiInfo>;
  quit: () => void;
  reload: () => void;
  saveFile: (options: SaveFileOptions) => Promise<SaveFileResult>;
  printReceipt: (payload: ReceiptPrintPayload) => Promise<PrintResult>;
  printKot: (payload: { tx: ReceiptPrintPayload['tx'] }) => Promise<PrintResult>;
  printPdf: (payload: { data: ArrayBuffer }) => Promise<{ printed: boolean }>;
};

declare global {
  interface Window {
    pos: PosBridge;
  }
}

export {};
