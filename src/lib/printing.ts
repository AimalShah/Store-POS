import { Settings, Transaction } from '../api/client';
import { getPosBridge } from '../bridge';

// Try thermal first; when unconfigured (or it fails) fall back to the
// browser's PDF/print path. Returns true when a thermal printer handled it.
export async function printReceipt(
  tx: Transaction,
  settings: Settings | null,
  printKot = false
): Promise<boolean> {
  try {
    const res = await getPosBridge().printReceipt({
      tx,
      settings: settings || {},
      printKot,
    });
    if (res.printed) return true;
  } catch {
    /* fall through to browser print */
  }
  window.print();
  return false;
}

export async function printKot(tx: Transaction): Promise<boolean> {
  try {
    const res = await getPosBridge().printKot({ tx });
    return res.printed;
  } catch {
    return false;
  }
}
