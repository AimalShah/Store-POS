/**
 * PrinterManager handles interaction with the system printer service.
 * It is driver-agnostic and expects a driver that implements the standard printer interface.
 */
export class PrinterManager {
  constructor(driver = null) {
    this.driver = driver;
  }

  /**
   * Returns a list of available system printers.
   */
  getPrinters() {
    if (!this.driver) {
      console.warn('PrinterManager: No driver available');
      return [];
    }
    try {
      // The 'printer' library or compatible drivers return printers as an array of objects
      return this.driver.getPrinters().map((p) => ({
        name: p.name,
        status: p.status || '',
        isDefault: !!p.isDefault,
      }));
    } catch (e) {
      console.error('PrinterManager.getPrinters failed:', e);
      return [];
    }
  }

  /**
   * Sends raw data to a specific printer.
   * This handles the Windows Spooler interaction.
   */
  async printRaw(printerName, rawData) {
    if (!this.driver) throw new Error('No driver configured');
    
    return new Promise((resolve, reject) => {
      // The modern 'printer' library uses printDirect
      this.driver.printDirect({
        data: rawData,
        printer: printerName,
        type: 'RAW',
        success: (jobID) => resolve(jobID),
        error: (err) => reject(err),
      });
    });
  }
}
