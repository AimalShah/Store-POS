# Store POS — Troubleshooting Guide

## Quick Diagnostic Commands

Run these first to understand the system state:

```bash
# 1. Check app version
# In-app: Settings → bottom shows version (e.g., 3.0.0)

# 2. Check database integrity
sqlite3 path/to/pos-v3.sqlite "PRAGMA integrity_check;"
# Should return: ok

# 3. Check database size
du -h path/to/pos-v3.sqlite

# 4. Check running processes
# Windows: tasklist | findstr electron
# Linux/macOS: ps aux | grep electron

# 5. Check port 8001
netstat -an | grep 8001
# Should show: 127.0.0.1:8001 LISTENING
```

---

## Startup Issues

### App Won't Launch / Blank White Window

| Cause | Fix |
|-------|-----|
| **Running in browser** | Must launch via Electron. Use installed shortcut or `npm run dev` |
| **Native module mismatch** | `npm run native:electron` (rebuilds better-sqlite3 for Electron) |
| **Corrupted userData** | Rename `%APPDATA%\POS` → `POS.bak`, relaunch (creates fresh DB) |
| **Missing Visual C++ Redist** (Windows) | Install [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe) |
| **GPU acceleration crash** | Launch with `--disable-gpu` flag (edit shortcut target) |

### "Local API server is not responding" Banner

| Cause | Fix |
|-------|-----|
| API process crashed | Close app completely (check Task Manager), reopen |
| Port 8001 in use | `netstat -ano | findstr :8001` → kill PID |
| Antivirus blocking | Add exception for `Store POS.exe` and `%APPDATA%\POS\` |
| Database locked | Another instance running? Backup tool locking file? |

### First-Run Wizard Doesn't Appear

- Database already exists → app thinks it's not first run
- To reset: Delete `pos-v3.sqlite` in data folder, restart app

---

## Authentication Issues

### PIN Login Not Working

| Cause | Fix |
|-------|-----|
| **User has no PIN set** | Admin → Team → Edit user → Set PIN |
| **Wrong user ID** | PIN is per-user; ensure correct user selected on PIN pad |
| **Caps/NumLock** | PIN is numeric only |
| **Rate limited** | Wait 15 min or restart app (clears in-memory limiter) |

### Password Login Fails

| Cause | Fix |
|-------|-----|
| **Wrong credentials** | Default: `admin` / `admin` (change immediately!) |
| **Force password change** | User must set new password on login |
| **Account doesn't exist** | Check Team → Users list |

### "Account no longer exists" After Login

- User was deleted while logged in
- Re-login with valid account

---

## Till / Billing Issues

### Barcode Scan Doesn't Add Item

| Check | Fix |
|-------|-----|
| Cursor in search box? | Click Search tab or press `Tab` to focus |
| Scanner sends Enter? | Most do; if not, configure scanner suffix |
| Product exists? | Catalog → search by barcode/name |
| Product has variants? | Popup opens — select size/modifiers first |

### Product Shows "Out of Stock" But Has Stock

- Check **Track Stock** enabled on product (Catalog → Edit → Advanced)
- Check `quantity` / `stock` fields in DB
- Low stock threshold may be triggering warning (not blocking)

### Variant/Modifier Popup Won't Close

- Must select required variant (Size) before **Add**
- Modifiers are optional — can skip
- Press **Cancel** to abort

### Cart Calculations Look Wrong

| Issue | Cause |
|-------|-------|
| Tax not showing | Settings → Till → Charge tax = ON |
| Discount not applying | Order discount at cart bottom; per-item discount on item row |
| Prices wrong with sizes | Base price = cheapest size; each size has own price |
| Change calculation off | Cash tendered must be entered in Cash payment line |

### Payment Modal Issues

| Problem | Fix |
|---------|-----|
| Can't open payment | Cart empty? Add items first |
| "Payment lines don't cover full amount" | Sum of payment lines ≥ total required |
| F2 doesn't work | Focus must be in app window (not browser devtools) |
| Escape doesn't close | Click backdrop or press Esc again |

### Receipt Not Printing

| Check | Fix |
|-------|-----|
| Printer configured? | Settings → Printers → Test Receipt |
| Paper loaded? | Check printer status lights |
| USB: correct device path? | Windows: COMx; Linux: /dev/usb/lp0 |
| Network: ping printer IP? | `ping 192.168.1.50` |
| Width correct? | 58mm vs 80mm mismatch = garbled output |
| Fallback to browser print? | Thermal failed → browser print dialog opens |

### Held Orders Missing

- Held orders = status 0 with `ref_number` starting with `H-`
- Check **Sales → filter Status: Held**
- Bell icon in top bar shows count

---

## Printing Issues (Thermal Printer)

### Test Print Fails Completely

```bash
# 1. Verify printer is reachable
# USB: ls -la /dev/usb/lp*    (Linux)
#      Device Manager → Ports (Windows)
# Network: ping <printer-ip>

# 2. Check node-thermal-printer compatibility
# Only EPSON/ESC-POS supported
# Star, Bixolon, Citizen usually work if ESC-POS mode enabled

# 3. Enable debug logging
# In electron/main.js, thermal.js: console.log() outputs to Electron console
```

### Receipt Prints Garbled / Wrong Size

| Symptom | Fix |
|---------|-----|
| Text tiny/cut off | Paper width mismatch: Settings→Printers→Width (58/80) |
| Chinese/garbage chars | Printer not in ESC-POS mode; check printer DIP switches |
| Missing lines | Buffer not flushed; `printer.execute()` handles this |
| Double printing | Two print calls; check auto-print KOT + manual print |

### KOT (Kitchen Ticket) Not Printing

| Check | Fix |
|-------|-----|
| KOT printer configured? | Separate config in Settings→Printers |
| Auto-print KOT enabled? | Toggle ON in KOT settings |
| Order is Delivery? | KOT skipped for Delivery fulfillment |
| KOT test works? | If test fails, fix KOT printer first |

### Cash Drawer Won't Open

> **Not implemented in v3.0** — no `drawer:open` command in thermal.js
> 
> **Workaround**: Many printers open drawer via ESC-POS command `ESC p m t1 t2`
> Add to `thermal.js` `writeReceipt()` before `printer.cut()`:
> ```js
> // Open cash drawer (pin 2, 50ms pulse)
> printer.raw(Buffer.from([0x1B, 0x70, 0x00, 0x32, 0x32]));
> ```

---

## Database / Data Issues

### "Database is Locked" Error

```
Error: SQLITE_BUSY: database is locked
```

| Cause | Fix |
|-------|-----|
| Backup running | Wait for backup to finish |
| Two app instances | Close all, restart one |
| WAL file stuck | Delete `-wal` and `-shm` files, restart |
| Antivirus scanning | Exclude POS folder |

### Corrupted Database

```bash
# 1. Backup current (even if corrupted)
cp pos-v3.sqlite pos-v3.sqlite.corrupt

# 2. Try recovery
sqlite3 pos-v3.sqlite.corrupt ".dump" | sqlite3 pos-v3.sqlite.recovered

# 3. Verify
sqlite3 pos-v3.sqlite.recovered "PRAGMA integrity_check;"

# 4. If ok, replace
mv pos-v3.sqlite.recovered pos-v3.sqlite
```

### Missing Data After Restart

- Check you're restoring to correct data folder
- Verify `pos-v3.sqlite` modified timestamp matches restore time
- App uses `%APPDATA%\POS` (Windows) — not install folder

### Duplicate Categories

- Migration runs on startup to deduplicate (keeps oldest ID)
- If persists: Settings → Categories → delete duplicates manually

---

## Network / Multi-Terminal Issues

### "Built for LAN" But Can't Connect Second Terminal

> **v3.0 is single-machine only**. The README refers to architecture readiness, not implemented feature.

**Current limitations:**
- API binds to `127.0.0.1` (loopback only)
- No session sync between instances
- Shared DB file on network drive = corruption risk (SQLite + WAL + SMB = bad)

**Workarounds (unsupported):**
1. **Remote Desktop** — single machine, multiple RDP sessions
2. **VPN + shared DB** — high risk of corruption
3. **Wait for v3.1** — planned multi-terminal with central API

---

## Performance Issues

### Slow Product Grid (>500 products)

- Grid renders all products at once (no virtualization)
- **Fix**: Archive inactive products (set stock=0, uncheck "Feature as Daily Special")
- **Future**: Virtualized list planned

### Slow Reports / Sales History

- Large date range + many transactions
- **Fix**: Narrow date range; monthly `VACUUM`/`ANALYZE`

### High Memory Usage

- Electron baseline ~350 MB
- Large images in media library → optimize uploads (max 5 MB, recommend <500 KB)

---

## Backup/Restore Issues

### Backup Fails with "Permission Denied"

- App running? Close it (locks DB)
- Antivirus? Exclude POS folder
- Destination full? Check disk space

### Restore Results in Empty App

| Check | Fix |
|-------|-----|
| Restored to correct folder? | `%APPDATA%\POS` not `Program Files\Store POS` |
| DB file named correctly? | `pos-v3.sqlite` (not `pos-v3.sqlite.bak`) |
| App closed during restore? | Must be fully closed |
| WAL/SHM files copied? | Copy entire `databases/` folder |

### Automated Backup Not Running

| Check | Fix |
|-------|-----|
| Task Scheduler history | Enable "Run whether user logged on or not" |
| PowerShell execution policy | `Set-ExecutionPolicy RemoteSigned` |
| Path with spaces quoted? | `"$env:APPDATA\POS"` |

---

## Update Issues

### Auto-Update Fails

| Error | Fix |
|-------|-----|
| "No internet" | Check firewall/proxy; GitHub API required |
| "Signature verification failed" | Corrupted download; manual reinstall |
| "Access denied" | Run as Admin (installer needs write to Program Files) |

### Manual Update

1. Download latest `.exe` from GitHub Releases
2. Run installer → preserves data in `%APPDATA%\POS\`
3. If fails: uninstall old, install new (data safe in AppData)

### Version Downgrade

- Migrations are **forward-only**
- Downgrading app version with newer DB = undefined behavior
- If needed: restore DB backup from before upgrade

---

## Platform-Specific Issues

### Windows

| Issue | Fix |
|-------|-----|
| "Missing VCRUNTIME140.dll" | Install VC++ Redistributable |
| SmartScreen blocks installer | "More info → Run anyway" |
| Auto-updater fails silently | Check `%LOCALAPPDATA%\Store POS\updater.log` |
| Long path issues | Enable long paths in Windows 10/11 settings |

### Linux

| Issue | Fix |
|-------|-----|
| AppImage won't run | `chmod +x file.AppImage`; install `libfuse2` |
| Wayland crashes on print | App uses PDF fallback; print from PDF viewer |
| Tray icon missing | Install `libappindicator3-1` |
| Snap confinement blocks DB | Use AppImage instead; Snap has strict confinement |

### macOS (Not Officially Supported)

| Issue | Fix |
|-------|-----|
| "App is damaged" | `xattr -cr /Applications/Store\ POS.app` |
| Notarization required | Build locally with Apple Developer cert |
| Native module rebuild | `npm run native:electron` on Apple Silicon |

---

## Logs & Debugging

### Enable Debug Logging

**Development:**
```bash
npm run dev
# Console logs in terminal + DevTools (F12)
```

**Production (Windows):**
```powershell
# Set env var before launch
$env:DEBUG = "pos:*"
Start-Process "Store POS.exe"
# Logs in %APPDATA%\POS\logs\main.log (if logger configured)
```

**Production (Linux):**
```bash
DEBUG=pos:* ./Store\ POS-3.0.0.AppImage
```

### Key Log Locations
| Platform | Log Path |
|----------|----------|
| Windows | `%APPDATA%\POS\logs\main.log` |
| Linux | `~/.config/POS/logs/main.log` |
| macOS | `~/Library/Application Support/POS/logs/main.log` |

### Useful Log Filters
```bash
# Database errors
grep -i "sqlite\|database\|migration" logs/main.log

# Printer errors
grep -i "thermal\|print\|printer" logs/main.log

# Auth errors
grep -i "jwt\|login\|auth\|pin" logs/main.log

# API errors
grep -i "500\|error\|failed" logs/main.log
```

---

## Contacting Support

Before reaching out, gather:

1. **App version** (Settings → bottom)
2. **OS + version**
3. **Steps to reproduce** (numbered)
4. **Expected vs actual behavior**
5. **Screenshots/video** of issue
6. **Relevant logs** (filter as above)
7. **Database integrity check** result
8. **Printer model + connection** (if print-related)

---

## Known Limitations (v3.0)

| Limitation | Workaround |
|------------|------------|
| No multi-terminal sync | Single machine only |
| No cash drawer kick | Add ESC-POS command to thermal.js |
| No barcode label printing | External tool (Brother P-touch, etc.) |
| No purchase orders | Manual stock adjustments |
| No ingredient auto-deduction | Manual wastage/usage in Stock |
| No loyalty/gift cards | Manual customer notes |
| Tax-inclusive pricing | Calculate base price manually |
| No refund workflow (guided) | Void transaction |
| No offline queue for cloud sync | N/A (fully offline) |

---

## Emergency Procedures

### Complete Reset (Nuclear Option)
> **Loses ALL data. Only if absolutely necessary.**

1. Close app
2. Delete data folder:
   - Windows: `Remove-Item "$env:APPDATA\POS" -Recurse -Force`
   - Linux/macOS: `rm -rf ~/.config/POS`
3. Relaunch → First-Run Wizard appears
4. Reconfigure everything

### Recover from Failed Migration
1. Backup current DB
2. Check `schema_version` table: `SELECT * FROM schema_version;`
3. If version mismatch, manual migration may be needed
4. Contact support with schema version + error log

---

## Frequently Asked Questions

**Q: Can I run this on a tablet?**
A: Windows tablets yes (touch works). iPad/Android no (Electron desktop only).

**Q: Does it work offline?**
A: Yes, 100% offline. No internet required after install.

**Q: Can I import products from CSV?**
A: Not in v3.0. Use Export → edit CSV → manual entry, or direct DB insert.

**Q: How do I change the invoice number format?**
A: Hardcoded as `INV-YYYYMMDD-NNN` (daily sequence). Not configurable.

**Q: Can I have multiple tax rates?**
A: Single tax rate only. Different rates = separate products with tax included in price.

**Q: Where are product images stored?**
A: `POS/uploads/library/` — copied there on upload, referenced by filename in DB.

**Q: How do I move to a new computer?**
A: Install app on new PC → copy old `%APPDATA%\POS` to new PC same location → launch.

**Q: Does it integrate with accounting software?**
A: Export → CSV/XLSX → import to Xero, QuickBooks, etc.

**Q: Can I customize the receipt layout?**
A: Modify `electron/thermal.js` `writeReceipt()` function (requires rebuild).

**Q: Is there an API for third-party integration?**
A: Local REST API on `http://127.0.0.1:8001/api` — see `server/routes/` for endpoints.