# Store POS

Modern desktop Point of Sale for a single register, completely offline. Version **3.0** rebuilds the original Electron app on a secure, maintainable stack.

## Features

### Till
- Barcode scan / search (Enter to add)
- Category filter chips
- Compact product tiles with thumbnail, price, and stock status
- **Fulfillment selector** — Dine-in / Takeaway / Delivery (default Takeaway, resets per new order)
- **Delivery details** — name, contact number, and address captured when Delivery is selected
- **Variants & modifiers** — products with options open a selection popup (variants are single-choice required, modifiers/toppings are multi-choice optional); line price updates with price deltas
- Cart with quantity controls, per-item note/discount, and tax
- Customer picker with quick-add
- Hold / resume orders
- **Void Order** — confirmed destructive discard of the whole order; **Clear** stays instant for quick resets
- Cash payment pad with South African note shortcuts (R10–R200) plus Exact
- Change / still-due display
- Printable receipt with a sequential daily invoice number, including chosen variants and modifiers

### PIN Login
- Fast numeric PIN entry for returning cashiers
- Admin username/password fallback for first login and recovery
- Configurable per user

### Two-Portal Navigation
- **Manager Portal** — Catalog, Sales history, Customers, Team, Settings (full permissions)
- **Cashier Portal** — Till only (focused, distraction-free)
- Role-based access: cashiers see only the Till; managers see everything

### Catalog
- Products and categories
- Inventory tracking (opt-in per product)
- Photo picker (local uploads to a media library)
- **Variants** — single-choice option groups (e.g. Size) with per-option price deltas; required at the till
- **Modifiers / toppings** — multi-choice option groups (e.g. Extra cheese) with per-option price deltas; optional at the till
- Multi-select **bulk delete**

### Sales
- Transaction history filtered by date range, cashier, till, and status (paid / held)
- Print or reprint invoices from the history

### Customers & Team
- Customer records
- Staff accounts with permission flags (products, categories, sales, users, settings)

### Settings
- Store identity (name, address, contact, logo, receipt footer)
- Currency symbol and optional tax

## Tech stack

| Layer | Technology |
|--------|------------|
| Desktop shell | Electron 43 (contextIsolation, preload bridge — no `nodeIntegration`) |
| UI | React 18 + TypeScript + Vite 6 |
| API | Express |
| Auth | JWT + bcrypt |
| Database | SQLite via **better-sqlite3** (native, WAL journaled, durable) |
| Installer | electron-builder (Windows NSIS) |

## Requirements

- Node.js 18+ (20 LTS recommended)
- Windows for the packaged installer (`npm run dist`); `npm run dev` works wherever Electron runs

## Quick start

```bash
npm install
npm run dev
```

Default login:

| Username | Password |
|----------|----------|
| `admin`  | `admin`  |

Change the admin password after first login in a production deployment.

### Till shortcuts

| Key | Action |
|-----|--------|
| **Enter** | Add scanned / searched item |
| **F2** | Open payment (charge) |
| **F4** | Held sales |
| **Esc** | Close payment modal |

## Offline mode

This app is a single-machine, fully offline POS. The local API runs on loopback `127.0.0.1:8001` with SQLite storage; it never opens a listening port to the LAN and makes no internet calls.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite + Electron (development) |
| `npm run build` | Production UI build into `dist/` |
| `npm start` | Electron against an existing build / config |
| `npm run smoke` | API + LAN smoke tests |
| `npm run dist` | Build UI and create Windows installer |

Installer output:

```text
release/Store POS Setup 3.0.0.exe
```

## Project layout

```text
electron/          Main process + secure preload (window.pos)
server/            Express API, better-sqlite3 database, route modules
  routes/          inventory, categories, customers, users, settings,
                   transactions, media
src/               React UI
  pages/           Till, Catalog, Sales, Settings, Login
  components/      Payment pad, photo picker, customer select, …
  layout/          App shell / sidebar
  api/client.ts    HTTP client
scripts/           Smoke tests
build/             App icons for the installer
public/favicon.ico Packaged favicon
```

Data and uploads live under Electron **userData** (not in the repo), so uninstalling may leave a database folder depending on OS settings.

## API overview

Local API base (standalone): `http://127.0.0.1:8001/api`

| Area | Examples |
|------|----------|
| Auth | `POST /users/login` |
| Catalog | `/inventory/products`, `/categories/all` |
| Sales | `POST /new`, `GET /by-date`, `GET /on-hold` |
| Media | `/media/library` |

Authenticated routes expect `Authorization: Bearer <token>`.

## Security notes

- Renderer has no Node integration; privileged actions go through the preload bridge.
- Change default `admin` credentials before real use.

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Blank window / `window.pos` missing | Use Electron via `npm run dev`, not a plain browser tab |
| Sales history empty | Date filters use local time; default range is month start → end of today |
| Media library 404 after code changes | Restart Electron so the API process reloads new routes |
| Native module build errors | Run `npm run rebuild` or `npx electron-rebuild -f -w better-sqlite3` (also rebuild `@thiagoelg/node-printer` on Windows: `npx electron-rebuild -f -w @thiagoelg/node-printer`) |
| USB printer not appearing in Settings | Confirm Windows shows it under Settings → Printers & scanners first — it needs a driver-backed queue (vendor driver or the generic/text-only class driver) before Store POS can see it. Click "Detect printers", or unplug/replug — the app polls every ~2.5s. |
| PIN login not working | Ensure user has a PIN set in Team settings; fallback to username/password |
| Cashier sees only Till | This is by design — cashiers have the focused Cashier Portal |
| Manager missing Catalog/Sales/etc. | Ensure user has the relevant permission flags in Team settings |

## License / authorship

Desktop POS application maintained for store use. See repository history for contributors to the original and 3.0 rewrite.
