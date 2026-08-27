export class PrinterManager {
  constructor(driver = null) {
    this.driver = driver;
  }

  getPrinters() {
    if (!this.driver) return [];
    try {
      return this.driver.getPrinters().map(p => ({
        name: p.name,
        status: p.status || '',
        isDefault: !!p.isDefault,
      }));
    } catch (e) {
      console.error('PrinterManager.getPrinters failed:', e);
      return [];
    }
  }

  async printRaw(printerName, data) {
    // Implement raw printing logic here
    console.log(`PrinterManager: Sending raw data to ${printerName}`);
  }
}
