# Store POS — Deployment Guide

## Overview
Store POS is a desktop Point-of-Sale application built with Electron, React, and Express. It runs completely offline on a single machine with a local SQLite database.

## System Requirements

### Minimum
- **OS**: Windows 10 (64-bit), macOS 11+, or Linux (glibc 2.28+)
- **RAM**: 4 GB
- **Storage**: 2 GB free space
- **Display**: 1366 × 768 minimum (1920 × 1080 recommended)
- **Node.js**: 18+ (20 LTS recommended) — only for development

### For Packaged App (Client Machine)
- No Node.js required — Electron bundles the runtime
- Windows: NSIS installer (`.exe`)
- Linux: AppImage or Snap
- macOS: Not currently built (requires Apple Developer account for notarization)

---

## Installation

### Windows (Packaged Installer)
1. Download `Store POS Setup 3.0.0.exe` from the latest GitHub Release
2. Run the installer as **Administrator** (required for auto-updater)
3. Follow the setup wizard:
   - Choose install location (default: `C:\Program Files\Store POS`)
   - Create Desktop shortcut (recommended)
   - Create Start Menu shortcut (recommended)
4. Launch **Store POS** from Desktop or Start Menu

### Linux (AppImage)
```bash
chmod +x Store\ POS-3.0.0.AppImage
./Store\ POS-3.0.0.AppImage
```

### Linux (Snap)
```bash
sudo snap install store-pos_3.0.0_amd64.snap --dangerous
```

---

## First Run — Required Setup

### 1. Launch the App
- Double-click the Store POS icon
- The app creates its data folder at:
  - **Windows**: `%APPDATA%\POS\`
  - **Linux**: `~/.config/POS/`
  - **macOS**: `~/Library/Application Support/POS/`

### 2. First-Run Wizard
On a brand-new database, you'll see the **First-Run Wizard**:
- **Store Name**: Your business name (appears on receipts)
- **Admin PIN**: 4+ digit PIN for quick cashier login (default: `123456` — **change this**)

Click **Complete Setup** to create the admin user.

### 3. Sign In
Two login methods:
- **PIN Pad**: Enter your 4+ digit PIN (auto-submits)
- **Password**: Username `admin` / Password `admin` (default)

> **⚠️ CRITICAL**: Change the default admin password immediately after first login.
> Go to **Settings → Team → Edit Admin → Change Password**.

---

## Post-Install Configuration

### 1. Store Settings (Settings → Store)
| Field | Purpose |
|-------|---------|
| Store Name | Appears on receipts and dashboard |
| Address Line 1/2 | Printed on receipt header |
| Contact | Phone/email on receipt |
| Receipt Footer | Custom message (thank you, return policy, etc.) |
| Store Logo | Upload PNG/JPG (max 5 MB) — prints on receipt |

### 2. Currency & Tax (Settings → Till)
| Setting | Description |
|---------|-------------|
| Currency Symbol | Default: `Rs` (change to `$`, `€`, `£`, etc.) |
| Charge Tax | Toggle on/off |
| Tax Label | e.g., `VAT`, `GST`, `Sales Tax` |
| Tax % | Percentage (e.g., `15` for 15%) |

> Tax is **exclusive** — added on top of product prices.

### 3. Printer Setup (Settings → Printers)

#### Receipt Printer
| Field | USB | Network |
|-------|-----|---------|
| Interface | `USB` | `Network` |
| USB Device | `/dev/usb/lp0` (Linux) or `COM3` (Windows) | — |
| Network Host | — | Printer IP (e.g., `192.168.1.50`) |
| Network Port | — | `9100` (default RAW port) |
| Paper Width | `58mm` or `80mm` | `58mm` or `80mm` |

#### Kitchen Order Ticket (KOT) Printer (Optional)
Same fields as receipt printer, prefixed with `KOT_`.
- **Auto-print KOT**: When enabled, KOT prints automatically on sale completion (except Delivery orders)

#### Test Printing
Click **Test Receipt** / **Test KOT** to verify connection.

> **Troubleshooting**: See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#thermal-printer-issues)

### 4. User Accounts & Roles (Settings → Team)

| Role | Permissions |
|------|-------------|
| **Admin** | Everything: users, settings, products, categories, sales, reports, printers |
| **Manager** | Products, categories, sales, customers, reports, shifts, drawers |
| **Cashier** | Till only (focused, distraction-free) |

**To add a cashier:**
1. Click **Add User**
2. Fill: Full Name, Username, Password, Role = `Cashier`
3. Set a **PIN** (4+ digits) for quick login
4. Save

---

## Data Location & Backup

### Where Data Lives
All data is stored in the **userData** folder (outside the app install):

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\POS\server\databases\pos-v3.sqlite` |
| Linux | `~/.config/POS/server/databases/pos-v3.sqlite` |
| macOS | `~/Library/Application Support/POS/server/databases/pos-v3.sqlite` |

Uploads (product images, logos): `POS/uploads/library/`

### Manual Backup (Critical)
**Do this daily** — copy the entire `POS` folder to external storage:

```bash
# Windows (PowerShell)
Copy-Item "$env:APPDATA\POS" "D:\Backups\POS-$(Get-Date -Format 'yyyyMMdd')" -Recurse

# Linux/macOS
cp -r ~/.config/POS ~/Backups/POS-$(date +%Y%m%d)
```

### Restore from Backup
1. Close Store POS completely
2. Replace the `POS` folder with your backup
3. Restart Store POS

### Automated Backup (Recommended)
Set up a scheduled task / cron job:

**Windows Task Scheduler:**
- Trigger: Daily at 02:00
- Action: `powershell.exe -Command "Copy-Item '$env:APPDATA\POS' 'D:\Backups\POS-$(Get-Date -Format \"yyyyMMdd\")' -Recurse"`

**Linux/macOS (cron):**
```bash
0 2 * * * cp -r ~/.config/POS ~/Backups/POS-$(date +\%Y\%m\%d)
```

---

## Auto-Updates
- Checks GitHub Releases every 4 hours
- Prompts: "Update available → Download now?" → "Restart now?"
- Requires internet access
- **Disable** by blocking `github.com` in firewall if air-gapped

---

## Uninstall
- **Windows**: Settings → Apps → Store POS → Uninstall
- **Data is preserved** in `%APPDATA%\POS\` — manually delete if unwanted

---

## Network / Multi-Terminal (Not Currently Supported)
> The app is **single-machine only** in v3.0.
> - API binds to `127.0.0.1:8001` (loopback only)
> - No built-in sync between terminals
> - For multi-terminal, run separate instances with shared DB on a file server (not tested/supported)

---

## Support Checklist Before Go-Live
- [ ] Admin password changed from default
- [ ] All cashier PINs set and tested
- [ ] Store details entered (name, address, contact, logo)
- [ ] Currency symbol correct
- [ ] Tax configured (or disabled)
- [ ] Receipt printer tested (print test receipt)
- [ ] KOT printer tested (if used)
- [ ] Backup schedule configured and verified
- [ ] Cash drawer kick tested (if applicable — not built-in)
- [ ] Test sale completed end-to-end (scan → pay → print)
- [ ] Void/hold/resume tested
- [ ] Shift open/close tested (X/Z reports)
- [ ] Team roles verified (cashiers see only Till)