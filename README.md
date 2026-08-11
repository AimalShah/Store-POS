# Store POS

Modern desktop Point of Sale for a single register, completely offline. Version **2.0** rebuilds the original Electron app on a secure, maintainable stack.

## Features

### Till
- Barcode scan / search (Enter to add)
- Category filter chips
- Product tiles with photos, price, and stock status
- Cart with quantity controls, discount, and tax
- Customer picker with quick-add
- Hold / resume sales
- Cash payment pad with South African note shortcuts (R10–R200) plus Exact
- Change / still-due display
- Printable invoice with a sequential daily invoice number

### Catalog
- Products and categories
- Inventory tracking
- Photo picker (local uploads to a media library)
- **Seed demo** sample catalog (SA-style products & customers)
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
- Demo data seed / full catalog & sales wipe

## Tech stack

| Layer | Technology |
|--------|------------|
| Desktop shell | Electron 33 (contextIsolation, preload bridge — no `nodeIntegration`) |
| UI | React 18 + TypeScript + Vite 6 |
| API | Express |
| Auth | JWT + bcrypt |
| Database | SQLite via **sql.js** (no native build toolchain required) |
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
release/Store POS Setup 2.0.0.exe
```

## Project layout

```text
electron/          Main process + secure preload (window.pos)
server/            Express API, sql.js database, route modules
  routes/          inventory, categories, customers, users, settings,
                   transactions, media, demo
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

## Demo data

From **Catalog** or **Settings → Demo data**:

- **Seed demo** — adds sample categories, products, and customers if those names do not already exist
- **Bulk delete** (Catalog) — delete selected products
- **Bulk delete catalog & sales** (Settings) — removes products, categories, sales history, and customers except Walk-in; keeps staff and settings

## API overview

Local API base (standalone): `http://127.0.0.1:8001/api`

| Area | Examples |
|------|----------|
| Auth | `POST /users/login` |
| Catalog | `/inventory/products`, `/categories/all` |
| Sales | `POST /new`, `GET /by-date`, `GET /on-hold` |
| Media | `/media/library` |
| Demo | `POST /demo/seed`, `POST /demo/clear` |

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
| Native module / SSL build errors | This project uses **sql.js** deliberately to avoid `better-sqlite3` compile issues |

## License / authorship

Desktop POS application maintained for store use. See repository history for contributors to the original and 2.0 rewrite.
