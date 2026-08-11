import type { ApiInfo, PosBridge } from './vite-env';

const FALLBACK_PORT = 8001;

function constantApiInfo(): ApiInfo {
  return {
    baseUrl: `http://127.0.0.1:${FALLBACK_PORT}/api`,
    healthUrl: `http://127.0.0.1:${FALLBACK_PORT}/`,
    till: 1,
  };
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
