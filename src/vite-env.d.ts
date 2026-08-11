/// <reference types="vite/client" />

export type ApiInfo = {
  baseUrl: string;
  healthUrl: string;
  till: number;
};

export type PosBridge = {
  getApiInfo: () => Promise<ApiInfo>;
  quit: () => void;
  reload: () => void;
};

declare global {
  interface Window {
    pos: PosBridge;
  }
}

export {};
