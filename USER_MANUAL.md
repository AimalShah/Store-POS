# Store POS — User Manual

## Quick Start

### Sign In
1. **PIN Login** (fast): Tap your 4+ digit PIN on the numeric pad — auto-submits
2. **Password Login**: Username `admin` / your password

> Forgot PIN? Use password login. Forgot password? Ask an Admin to reset it in **Team**.

---

## App Layout

After login, you choose where to go:
- **Dashboard** — Management, reports, inventory, settings
- **Till / Billing** — Start a sale, take payments

Switch anytime via the **Mode Switcher** (top bar).

---

## Till / Billing — Making a Sale

### 1. Add Products
- **Category tabs**: Pizzas, Burgers, Drinks, etc. — tap to filter
- **Search tab**: Type product name or scan barcode → **Enter** to add
- **Product tiles**: Tap to add; coloured by category; dimmed if out of stock

### 2. Variants & Modifiers
Some products have options:
- **Variants** (required, single choice): e.g., Size — Small / Medium / Large
- **Modifiers** (optional, multi-choice): e.g., Toppings — Extra cheese, Jalapeños

A popup appears automatically — select options → **Add**.

### 3. Cart (Right Panel)
- **Qty steppers**: `+/-` to adjust quantity
- **Per-item discount**: Tap item → set discount (flat or %)
- **Customer**: Tap customer chip → choose saved customer or create one-time
- **Fulfillment**: Dine-in / Takeaway / Delivery
  - **Delivery** requires customer details (name, phone, address)
- **Order discount**: Bottom of cart — flat amount off subtotal
- **Hold**: Parks order for later (badge shows count in top bar)
- **Clear**: Instant reset (no confirmation)

### 4. Checkout — Payment
Press **Pay** (or **F2**) → Payment modal opens:

| Tab | Use For |
|-----|---------|
| **Cash** | Enter amount tendered; shows change |
| **Card** | Exact amount (no change) |
| **Mobile** | Exact amount (no change) |

**Split payments**: Add multiple lines (e.g., Cash R50 + Card R30).
- **Total to pay** / **Amount paid** / **Still owed** / **Change back** shown live
- Press **Pay Now** when paid ≥ total

### 5. Receipt
On completion: **Sale Complete & Receipt** modal opens.
- **Print** (primary button) → sends to thermal printer
- **Close** → returns to empty cart (receipt not printed)

> Receipt shows: Invoice # (daily sequence), items with variants/modifiers, totals, payment breakdown, change.

### 6. Held Orders
- Top bar **bell icon** → shows count
- Click → list of parked orders
- **Resume** → loads into cart
- **Discard** → deletes permanently

### 7. Keyboard Shortcuts (Till)
| Key | Action |
|-----|--------|
| **Enter** | Add scanned/searched item |
| **F2** | Open payment |
| **F4** | Held orders |
| **Esc** | Close payment modal |

---

## Dashboard (Manager View)

### KPI Cards
- Sales, Orders, Average Order, Items Sold — for selected date range

### Sales Trend Chart
- Daily revenue bars across the range

### Quick Actions
- **Quick Sale** → jumps to Till
- **Held Orders** → same as top bar bell
- **Low Stock** → jumps to Catalog filtered to low-stock items

### Low Stock Alert
- Top bar chip shows count → click to view

---

## Catalog (Products & Categories)

### Products Tab
**List view** with search, multi-select, bulk delete.

**Add/Edit Product:**
| Field | Required? | Notes |
|-------|-----------|-------|
| Name | Yes | |
| Price | Yes | Base price (if no sizes) |
| Cost | No | For profit reports |
| Section | No | Category (Drinks, Mains, etc.) |
| Photo | No | Upload from computer |
| Feature as Daily Special | No | Highlights in till |
| **Sizes** | No | Add sizes → each has own price & cost (replaces base price) |
| **Modifiers** | No | Groups of options (Toppings, Sides) — multi-choice |
| **Combo Components** | No | Link existing products (Meal = Burger + Fries + Drink) |

> **Sizes vs Base Price**: If you add sizes, the base price becomes "From R{cheapest size}" and cost is cleared. Each size carries its own cost for accurate COGS.

### Categories Tab
- Name + Icon (searchable Lucide library) + Colour
- Used for till tabs and reporting

---

## Customers
- Search, add, edit, delete
- Fields: Name, Phone, Email, Address
- **Walk-in Customer** always exists (cannot delete)
- Used for: Delivery details, customer history, loyalty (future)

---

## Sales History (Manager)
- Filter by: Date range, Cashier, Till, Status (Paid / Held / Voided)
- **Print / Reprint** any invoice
- **Void** a completed sale → restores stock, marks status=Voided

---

## Shifts (Cash Management)
- **Open Shift**: Enter float amount (starting cash in drawer)
- **X Report** (mid-shift): Sales summary without closing
- **Close Shift (Z Report)**: Enter counted cash → shows expected vs actual, variance
- Reports show: Cash/Card/Mobile sales, sale count, refunds

---

## Drawer Sessions (Alternative to Shifts)
- Simpler cash tracking per till
- Open → enter float → close → enter counted cash
- Live view: expected cash = float + cash sales since open

---

## Reports (Manager)
- **Sales Summary**: Totals, by category, by payment method, best sellers
- **Date range** picker in top bar controls all reports

---

## Stock (Manager)
- **Stock History**: All movements (sale, restock, wastage, adjustment)
- **Low Stock / Out of Stock** filters
- **Stock Value**: Current inventory worth (cost-based)

---

## Team / Users (Admin)
- Add/edit/delete users
- Assign **Role**: Admin / Manager / Cashier
- Set **PIN** for quick login
- **Force password change** on next login

---

## Settings
### Store
- Name, address, contact, logo, receipt footer

### Till
- Currency symbol, tax settings, theme preset (Black & White / Green)

### Printers
- Receipt & KOT printer config (USB or Network)
- Test buttons

---

## Export (Manager)
- Export transactions to **CSV** or **XLSX**
- Filter by date range

---

## Audit Log (Admin)
- Who did what, when: create/update/delete/void on transactions, products, customers, users, settings, categories, shifts, drawers

---

## Common Tasks

### Process a Refund
1. Dashboard → **Sales** → find transaction
2. Click **Void** → confirms
3. Stock restored, sale marked voided

### Add a New Product Quickly
1. Dashboard → **Catalog** → **Products** tab
2. Click **Add product** (or edit existing)
3. Fill essentials → **Add product**

### Run End-of-Day
1. Dashboard → **Shifts** (or **Drawer**)
2. **Close Shift** / **Close Drawer**
3. Count physical cash → enter amount
4. Review Z Report / Drawer Summary → print or save

### Change Receipt Footer
1. **Settings** → **Store** → **Receipt footer**
2. Enter text (e.g., "Thank you! Visit again.")
3. **Save settings**

### Switch Theme
1. **Settings** → **Till** → **Theme preset**
2. Click **Black & White** or **Green**
3. Applies instantly, persists

---

## Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| "Server not responding" banner | Close app, reopen (restarts local API) |
| Receipt prints blank/garbled | Check printer width (58/80mm), test print in Settings→Printers |
| Cashier sees only Till | By design — Cashier role = Till only |
| Can't see Catalog/Sales/Reports | User needs Manager/Admin role → Team → Edit user |
| Low stock alert won't clear | Restock product in Catalog, or adjust threshold |
| Barcode scan not working | Ensure cursor in search box, scan → Enter adds item |
| Forgot admin password | Delete `pos-v3.sqlite` in data folder → re-run first-run wizard (loses all data) |

---

## Data Safety
- **All data is local** — no cloud, no internet required
- **Backup daily**: Copy `%APPDATA%\POS` (Windows) or `~/.config/POS` (Linux) to external drive
- **Uninstall keeps data** — manually delete folder to wipe