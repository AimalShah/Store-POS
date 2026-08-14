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

// Print a generated, professional PDF report (sales report, X/Z shift report,
// invoice, …) through a dedicated chrome-free window in the Electron main
// process. Falls back to a browser print if the bridge is unavailable.
export async function printReportPdf(data: ArrayBuffer): Promise<void> {
  // e2e test hook: capture the generated PDF bytes instead of opening a print
  // window so specs can assert on the document without a real printer.
  if ((window as any).__PRINT_CAPTURE) {
    (window as any).__printData = data;
    return;
  }
  try {
    await getPosBridge().printPdf({ data });
    return;
  } catch {
    /* fall through to browser print */
  }
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'width=800,height=1000');
  if (!w) {
    window.print();
    return;
  }
  w.focus();
  setTimeout(() => w.close(), 500);
}
