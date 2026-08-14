# Store POS — App Flow & Features

A desktop Point-of-Sale built with **React + Vite**, **shadcn/ui**, and **Electron**, backed by a **Node/Express + better-sqlite3** API. This document walks the user-facing flow and the features available in each screen.

---

## 1. Authentication & First Run

- **First-run wizard** (`FirstRunWizard`): on a brand-new database the app asks for a store name and an admin PIN, then creates the admin user. (`screenshots/01-login.png` shows the sign-in panel.)
- **Sign-in** (`LoginPage`) offers two methods:
  - **PIN pad** — numeric pad; auto-submits once 4+ digits are entered. Default admin PIN is `123456`.
  - **Password** — `admin` / `admin` out of the box.
- A **server error** banner surfaces connection problems (e.g. API not running).

![Login](screenshots/01-login.png)

## 2. Landing / Mode Selector

After a successful login the app does **not** jump straight into selling. It shows a **selection screen** so the user chooses where to go:

- **Dashboard** — management, reporting, inventory, settings.
- **Till / Billing** — start a sale and take payments.

The top-bar mode switcher lets the user move between the two later (with a confirm prompt when leaving an in-progress order).

![Landing](screenshots/02-landing.png)

## 3. Dashboard

The management home (`DashboardView`):

- KPI cards (sales, orders, etc.) and a sales trend chart driven by the selected **date range**.
- **Low-stock alerts** — a top-bar warning chips straight to the catalog.
- **Quick Sale** button jumps into the Till.
- **Held orders** and **low-stock** shortcuts.

![Dashboard](screenshots/page-dashboard.png)

## 4. Till / Billing

The counter screen (`TillView`) — full-screen, designed for speed:

- **Category tabs** (Pizzas, Burgers, Chinese, Soup, Snacks, Drinks, Deals) with hard-shadow pills; active tab is tinted in the category colour. An extra **Search** tab reveals an inline product search.
- **Product grid** — each tile is coloured by its category; out-of-stock items are dimmed.
- **Variant / modifier popup** — products with sizes or modifiers open a popup to choose options before adding to the cart.
- **Cart** — line items with quantity steppers and a category-coloured accent; supports **discounts**, **customer** assignment, and **fulfilment** (Dine-in / Takeaway / Delivery). Orders can be **Held** and resumed later (badged in the top bar).
- **Checkout** (`PaymentPad`):
  - Two-pane modal: amount entry + **Exact** / note quick-cash buttons on the left, numeric keypad on the right.
  - **Multi-method payments** (cash, card, mobile) with tendered/change maths.
  - Summary: Total to pay, Amount paid, Payments added, Still owed, Change back, **Pay Now**.
- **Receipt** — on completion the sale clears and a **Sale Complete & Receipt** modal opens (no forced print). The **Print** button is primary and fills the footer; the receipt renders at full height (no inner scroll).

![Till](screenshots/04-till.png) · ![Till – Pizzas](screenshots/till-pizzas.png) · ![Variant popup](screenshots/05-variant-popup.png) · ![Cart](screenshots/06-cart.png) · ![Checkout](screenshots/07-checkout.png) · ![Receipt](screenshots/08-receipt.png)

## 5. Top Bar (shared)

Present across Dashboard and Till:

- **Mode switcher** (Till ⇄ Dashboard).
- **Date-range picker** (Dashboard only).
- **Search / command palette** (⌘K) — fuzzy-navigate pages, products, and run actions like *New Sale* / *Refresh*.
- **Held-orders bell** with count badge.
- **Low-stock alert** chip.
- **New Sale** button → Till.
- **Account dropdown** — Profile, Settings, Sign out, Quit.

![Account dropdown](screenshots/top-account-dropdown.png) · ![Search palette](screenshots/top-search.png)

## 6. Sidebar Pages

| Page | What it does |
|------|--------------|
| **Sales** | Browse/print past transactions (embedded transactions browser). |
| **Shifts** | Open/close shifts; view **X** (mid-shift) and **Z** (end-of-shift) reports with float and counted cash. |
| **Reports** | Sales analytics (charts, breakdowns). |
| **Catalog** | Manage products and categories (price, cost, stock, images, variants/modifiers). |
| **Stock History** | Track stock movements. |
| **Customers** | Customer directory. |
| **Team** | Users and their permissions (products, categories, transactions, users, settings). |
| **Settings** | Store details, tax, branding, and **theme presets** (Black & White / Green) that restyle the whole app via CSS variables. |
| **Export** | Export data (e.g. spreadsheet). |
| **Printers** | Configure receipt/kitchen printer output. |

![Catalog](screenshots/page-catalog.png) · ![Customers](screenshots/page-customers.png) · ![Team](screenshots/page-team.png) · ![Settings](screenshots/page-settings.png) · ![Sales](screenshots/page-sales.png) · ![Shifts](screenshots/page-shifts.png) · ![Reports](screenshots/page-reports.png) · ![Stock](screenshots/page-stock.png) · ![Export](screenshots/page-export.png) · ![Printers](screenshots/page-printers.png)

## 7. Theming

Two presets applied via a `data-theme` attribute and CSS variables:

- **Monochrome** (`mono`) — near-black primary, white surfaces.
- **Green** (`b3cUgBI8FX`, default) — green primary with pink-tinted neutrals and sharp (`--radius: 0`) corners.

The chosen theme is persisted in **Settings** and re-applied on launch.

## 8. Technical Notes

- **Frontend:** React 18, Vite, TypeScript, shadcn/ui (Base UI), Tailwind v4, Recharts.
- **Desktop:** Electron shell that loads the Vite dev server (or built `dist`) and spawns the local API.
- **Backend:** Express REST API on `:8001` (`/api`), SQLite via `better-sqlite3`, JWT auth, bcrypt-hashed passwords/PINs.
- **Local-first:** all data lives in a local SQLite database; the app is built for LAN multi-terminal use.

---

### Screenshot index

`01-login`, `02-landing`, `03-dashboard`, `04-till`, `05-variant-popup`, `06-cart`, `07-checkout`, `08-receipt`, `09-settings`, plus the page-set `page-*` and interaction shots `top-account-dropdown`, `top-search`, `till-pizzas`. All live in `screenshots/`.
