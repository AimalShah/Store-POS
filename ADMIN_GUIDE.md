# Store POS — Admin Guide

## Overview
This guide covers administrative tasks: user management, backup/restore, printer configuration, database maintenance, and advanced settings.

---

## User & Role Management

### Roles & Permissions

| Feature | Admin | Manager | Cashier |
|---------|-------|---------|---------|
| Till / Billing | ✅ | ✅ | ✅ |
| Dashboard (KPIs, charts) | ✅ | ✅ | ❌ |
| Catalog (Products) | ✅ | ✅ | ❌ |
| Categories | ✅ | ✅ | ❌ |
| Sales History | ✅ | ✅ | ❌ |
| Customers | ✅ | ✅ | ❌ |
| Team (Users) | ✅ | ❌ | ❌ |
| Settings (Store, Tax, Theme) | ✅ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Shifts | ✅ | ✅ | ❌ |
| Drawer Sessions | ✅ | ✅ | ❌ |
| Stock History | ✅ | ✅ | ❌ |
| Export Data | ✅ | ✅ | ❌ |
| Printers | ✅ | ❌ | ❌ |
| Audit Log | ✅ | ❌ | ❌ |

### Adding a User
1. **Settings → Team → Add User**
2. Fill:
   - **Full Name** — display name
   - **Username** — login identifier (unique)
   - **Password** — initial password (user can change)
   - **PIN** — 4+ digits for quick login (optional but recommended)
   - **Role** — Admin / Manager / Cashier
3. **Save** → user can sign in immediately

### Editing a User
- Click **Edit** (pencil icon) on any user row
- Change: Full Name, Password, PIN, Role
- **Force Password Change** — toggle on to require reset on next login
- **Delete** — removes user (cannot delete yourself or last Admin)

### Resetting a Forgotten Password
1. Admin signs in → **Team → Edit user → Set new password**
2. Enable **Force Password Change** → user must set new one on login

### PIN Best Practices
- 6+ digits recommended
- Unique per user
- Treat like a password — don't share

---

## Backup & Restore

### What to Back Up
The entire `POS` data folder:
```
POS/
├── server/
│   └── databases/
│       ├── pos-v3.sqlite          # Main database
│       ├── pos-v3.sqlite-wal      # WAL journal (if open)
│       └── pos-v3.sqlite-shm      # Shared memory (if open)
└── uploads/
    └── library/                   # Product images, logos
```

### Locations by Platform
| OS | Path |
|----|------|
| Windows | `%APPDATA%\POS\` |
| Linux | `~/.config/POS\` |
| macOS | `~/Library/Application Support/POS\` |

### Manual Backup (One-Time)
```bash
# Windows (PowerShell)
$date = Get-Date -Format 'yyyyMMdd_HHmm'
Copy-Item "$env:APPDATA\POS" "D:\Backups\POS_$date" -Recurse

# Linux/macOS
date=$(date +%Y%m%d_%H%M)
cp -r ~/.config/POS ~/Backups/POS_$date
```

### Automated Daily Backup

#### Windows (Task Scheduler)
1. Open **Task Scheduler** → Create Basic Task
2. Name: `Store POS Daily Backup`
3. Trigger: Daily, 02:00 AM
4. Action: Start a Program
   - Program: `powershell.exe`
   - Arguments:
     ```powershell
     -Command "$d=Get-Date -Format 'yyyyMMdd'; Copy-Item \"$env:APPDATA\POS\" \"D:\Backups\POS_$d\" -Recurse -Force; Write-EventLog -LogName Application -Source 'StorePOS' -EventId 100 -Message \"Backup completed to D:\Backups\POS_$d\""
     ```
5. Finish → Test with **Run**

#### Linux/macOS (cron)
```bash
crontab -e
# Add:
0 2 * * * /bin/bash -c 'd=$(date +\%Y\%m\%d); cp -r ~/.config/POS ~/Backups/POS_$d && logger -t StorePOS "Backup completed to ~/Backups/POS_$d"'
```

### Verify Backup
```bash
# Check backup exists and has data
ls -la ~/Backups/POS_$(date +%Y%m%d)/
# Should show: server/, uploads/

# Quick integrity check (Linux/macOS)
sqlite3 ~/Backups/POS_$(date +%Y%m%d)/server/databases/pos-v3.sqlite "PRAGMA integrity_check;"
# Should return: ok
```

### Restore Procedure
> **⚠️ This overwrites current data. Ensure app is CLOSED.**

1. **Close Store POS completely** (check system tray / task manager)
2. **Backup current data first** (in case restore fails)
3. **Replace the POS folder**:
   ```bash
   # Windows
   Remove-Item "$env:APPDATA\POS" -Recurse -Force
   Copy-Item "D:\Backups\POS_20240115" "$env:APPDATA\POS" -Recurse

   # Linux/macOS
   rm -rf ~/.config/POS
   cp -r ~/Backups/POS_20240115 ~/.config/POS
   ```
4. **Restart Store POS** → should open with restored data

### Backup Retention Policy (Recommended)
| Frequency | Retention |
|-----------|-----------|
| Daily | 30 days |
| Weekly (Sunday) | 12 weeks |
| Monthly (1st) | 12 months |
| Yearly | Indefinite |

---

## Printer Configuration Deep Dive

### Supported Printers
- **Thermal receipt printers** (EPOS/ESC-POS compatible)
- Common brands: Epson (TM-T20, TM-T88), Star (TSP100), Bixolon, Citizen
- **Not supported**: Standard inkjet/laser printers (no ESC-POS)

### Connection Types

#### USB (Most Reliable)
1. Install printer driver (manufacturer website)
2. Note device path:
   - **Windows**: `COM3`, `COM4`, etc. (check Device Manager → Ports)
   - **Linux**: `/dev/usb/lp0`, `/dev/usb/lp1`
3. In **Settings → Printers → Receipt Printer**:
   - Interface: `USB`
   - USB Device: paste path
   - Width: `58` or `80` (mm)
4. **Test Receipt**

#### Network (LAN/WiFi)
1. Printer on same network as POS machine
2. Static IP recommended (DHCP reservation)
3. Default port: `9100` (RAW/TCP)
4. In **Settings → Printers → Receipt Printer**:
   - Interface: `Network`
   - Network Host: `192.168.1.50` (printer IP)
   - Network Port: `9100`
   - Width: `58` or `80`
5. **Test Receipt**

### KOT (Kitchen Order Ticket) Printer
- Separate printer for kitchen
- Same config as receipt printer
- **Auto-print KOT**: When ON, prints automatically on sale (except Delivery)
- Test with **Test KOT** button

### Common Printer Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Printer not configured" | No config saved | Complete Settings→Printers, Save |
| Test print fails (USB) | Wrong device path | Check Device Manager / `ls /dev/usb/` |
| Test print fails (Network) | Wrong IP / port / firewall | Ping printer IP; check port 9100 open |
| Garbled/giant text | Wrong paper width | Set correct width (58/80mm) |
| Cuts paper mid-receipt | Missing `cut()` command | Update thermal.js (uses `printer.cut()`) |
| KOT doesn't auto-print | Auto-print OFF or Delivery order | Enable Auto-print KOT; Delivery excluded |

### Thermal Printer Maintenance
- **Clean print head** monthly (isopropyl alcohol + lint-free cloth)
- **Replace paper roll** before empty (prevents head damage)
- **Check firmware** — some printers need ESC-POS mode enabled

---

## Database Maintenance

### SQLite Database File
- **File**: `pos-v3.sqlite` (in `server/databases/`)
- **Engine**: better-sqlite3 (native, WAL mode)
- **Schema version**: Tracked in `schema_version` table

### Routine Maintenance (Monthly)
```sql
-- Run via sqlite3 CLI or any SQLite tool
PRAGMA wal_checkpoint(FULL);        -- Flush WAL to main DB
VACUUM;                             -- Reclaim space, defragment
ANALYZE;                            -- Update query planner stats
```

#### Windows (PowerShell)
```powershell
# Install sqlite3 tools first: choco install sqlite
sqlite3 "$env:APPDATA\POS\server\databases\pos-v3.sqlite" "PRAGMA wal_checkpoint(FULL); VACUUM; ANALYZE;"
```

#### Linux/macOS
```bash
sqlite3 ~/.config/POS/server/databases/pos-v3.sqlite "PRAGMA wal_checkpoint(FULL); VACUUM; ANALYZE;"
```

### Monitor Database Size
```bash
# Check size
du -h ~/.config/POS/server/databases/pos-v3.sqlite

# If > 500 MB, consider archiving old transactions
```

### Archive Old Transactions (Advanced)
> Only if DB grows large (>500 MB). Requires SQL knowledge.

```sql
-- Create archive table
CREATE TABLE transactions_archive AS
SELECT * FROM transactions WHERE date < '2023-01-01';

-- Delete from main table
DELETE FROM transactions WHERE date < '2023-01-01';

-- Vacuum after
VACUUM;
```

> Archived data won't appear in Sales/Reports. Keep archive DB separate for audits.

### Schema Migrations
- Automatic on app startup (see `server/db.js`)
- Logs: `console.log` in Electron main process
- **Never edit DB manually** unless instructed by support

---

## Tax Configuration

### Tax Modes
| Setting | Behavior |
|---------|----------|
| **Charge Tax = OFF** | No tax added, prices are final |
| **Charge Tax = ON** | Tax % added on top of prices |

### Setup
1. **Settings → Till**
2. **Charge tax on sales** → ON
3. **Tax label** → `VAT` / `GST` / `Sales Tax`
4. **Tax %** → `15` (for 15%)
5. **Save settings**

### Tax on Receipts
- Shows as separate line: `VAT (15%)  R15.00`
- Included in totals breakdown

### Tax Reports
- **Reports → Sales Summary** shows tax collected
- **Export** includes tax column per transaction

---

## Currency & Localization

### Change Currency Symbol
1. **Settings → Till → Currency symbol**
2. Enter: `R` `₹` `$` `€` `£` `¥` etc.
3. **Save** → updates everywhere (till, receipts, reports)

### Decimal Places
- Hardcoded to **2 decimal places** (standard for currency)
- Not configurable

### Date/Time Format
- Uses browser/system locale
- Receipts: `toLocaleString()` (e.g., `1/15/2024, 2:30:45 PM`)

---

## Theme & Branding

### Theme Presets
| Theme | Primary | Radius | Use Case |
|-------|---------|--------|----------|
| **Green** (default) | Green | Sharp (0) | Standard |
| **Black & White** | Near-black | Rounded | High contrast / accessibility |

Set in **Settings → Till → Theme preset** — applies instantly, persists.

### Store Logo on Receipts
1. **Settings → Store → Store logo**
2. Upload PNG/JPG (max 5 MB, recommend 300×100px)
3. **Save** → prints at top of every receipt

### Receipt Footer
1. **Settings → Store → Receipt footer**
2. Text: "Thank you! | VAT Reg: 123456 | www.store.com"
3. **Save** → prints at bottom of every receipt

---

## Audit Log (Compliance)

### What's Logged
| Action | Entities |
|--------|----------|
| create / update / delete / void | Transaction, Product, Customer, User, Settings, Category, Shift, Drawer Session |

### View Audit Log
- **Settings → Audit Log** (Admin only)
- Filter by: User, Entity Type, Date Range
- Shows: Before/After JSON snapshots

### Export for Auditors
- No direct export — use browser DevTools → Network → copy response
- Or query DB directly:
  ```sql
  SELECT * FROM audit_log WHERE created_at > '2024-01-01' ORDER BY created_at DESC;
  ```

---

## Performance Tuning

### For Large Catalogs (>1000 products)
- Product grid loads all at once — consider:
  - Archiving inactive products (set stock=0, hide from till)
  - Database index on `products.name` exists

### For High Transaction Volume (>10k/month)
- Monthly `VACUUM` + `ANALYZE`
- Archive transactions older than 2 years
- Ensure SSD storage (HDD slows SQLite WAL)

### Memory
- Electron main process: ~150 MB baseline
- Renderer: ~200 MB with large catalog
- 4 GB RAM sufficient for typical use

---

## Security Hardening

### Change Defaults Immediately
- [ ] Admin password ≠ `admin`
- [ ] Admin PIN ≠ `123456`
- [ ] All cashiers have unique PINs
- [ ] No shared accounts

### Network Isolation
- App binds API to `127.0.0.1:8001` only
- No external ports opened
- If multi-terminal needed later: reverse proxy + auth (not built-in)

### File Permissions (Linux/macOS)
```bash
# Restrict data folder to POS user only
chmod 700 ~/.config/POS
chmod 600 ~/.config/POS/server/databases/pos-v3.sqlite
```

### Auto-Updater
- Verifies GitHub Release signatures
- Disable if air-gapped: block `github.com` in firewall

---

## Troubleshooting Admin Issues

### "Database Locked" Error
- Another process has DB open (backup tool, another app instance)
- Fix: Close all POS windows, check task manager, restart

### Migration Failed on Startup
- Check Electron console logs (Ctrl+Shift+I in dev, or logs in `%APPDATA%\POS\logs\`)
- Common: `better-sqlite3` native module mismatch → run `npm run native:electron`

### Printer Settings Not Saving
- Check DB write permissions
- Verify `printer_settings` table exists (auto-migrated)

### Shift/Drawer Won't Close
- Must enter counted cash ≥ 0
- Check for open transactions blocking (all must be status=1 or 0)

---

## Version Upgrades

### In-App Auto-Update
1. Banner appears: "Update available"
2. Click **Download** → **Restart now**
3. App restarts on new version

### Manual Upgrade (Windows)
1. Download new `Store POS Setup X.Y.Z.exe`
2. Run installer → chooses same folder → preserves data
3. Data folder (`%APPDATA%\POS\`) untouched

### Rollback (If Update Breaks)
1. Uninstall new version
2. Reinstall previous version's `.exe`
3. Data compatible across minor versions (migrations forward-only)

---

## Support Information to Collect

When reporting issues, include:
1. **OS + version** (Windows 10 22H2, Ubuntu 22.04, etc.)
2. **App version** (Settings → bottom, or About dialog)
3. **Steps to reproduce**
4. **Console logs**:
   - Dev: F12 → Console
   - Prod: `%APPDATA%\POS\logs\main.log` (if logging enabled)
5. **Database size** + `PRAGMA integrity_check` result
6. **Printer model + connection type** (if print-related)