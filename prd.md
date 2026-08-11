# Product Requirements Document
## Offline POS System — [Restaurant Name]

**Prepared for:** Adnan
**Prepared by:** Aimal Shah, 404 STUDIO
**Version:** 1.0 (Draft)
**Date:** [Date]

---

## 1. Overview

A desktop Point-of-Sale application for a fast food restaurant. Runs fully offline, handles order-taking, invoice/receipt generation and printing, menu/catalog management, and inventory tracking. Built as a native-feeling desktop app (Electron).

## 2. Problem Statement

The restaurant currently has no digital system for taking orders, printing bills, or tracking stock. This causes slow order processing, no sales visibility, and manual/error-prone inventory management. A local POS solves this without depending on internet access.

## 3. Goals

- Cashiers can take an order and print a receipt in under 30 seconds.
- Zero downtime from internet loss — app works 100% offline.
- Owner/manager gets daily sales and inventory visibility without manual counting.
- Stock auto-updates as items are sold.

**Out of scope for success metrics:** online ordering, multi-branch sync, customer loyalty programs (v1).

## 4. Users & Roles

| Role | Access |
|---|---|
| Cashier | Take orders, process payment, print receipt, view own shift sales |
| Manager/Admin | Everything above + menu/inventory management, reports, user management, day-close (Z report) |

Login via PIN per user (not full username/password — speed matters at a counter).

## 5. Core Features

### 5.1 Menu / Catalog Management — P0
- Add/edit/delete items with name, price, category, image (optional)
- Categories (e.g. Burgers, Sides, Drinks, Deals)
- Mark item as out-of-stock / hide from POS screen
- Combo/deal items (bundle pricing)

### 5.2 Order / Sales Screen — P0
- Touch-friendly grid of menu items by category
- Cart with quantity, item-level notes (e.g. "no onion")
- Discounts (flat or %) at item or order level
- Tax calculation (configurable rate)
- Split/multiple payment types: cash, card, mobile wallet (record only, no gateway integration needed for v1)
- Hold/park an order and resume later

### 5.3 Invoicing & Receipt Printing — P0
- Generate invoice on order completion with sequential invoice number
- Print to thermal receipt printer (58mm/80mm, ESC/POS)
- Reprint any past invoice
- Optional: kitchen order ticket (KOT) print to a second printer
- PDF export/print fallback for A4/letter printers

### 5.4 Inventory Management — P0
- Track raw ingredients/stock items separately from menu items
- Recipe mapping: 1 sold item deducts mapped ingredient quantities automatically
- Manual stock adjustment (restock, wastage)
- Low-stock alert on dashboard
- Stock history log

### 5.5 Reporting — P1
- Daily sales summary (total, by category, by payment type)
- X report (mid-shift snapshot, no reset)
- Z report (end-of-day close, resets running totals)
- Best-selling items
- Date-range sales report

### 5.6 User Management & Shifts — P1
- Add cashiers/admins with PIN
- Shift open/close with starting and closing cash count
- Cash reconciliation (expected vs actual)

### 5.7 Offline-First & Data — P0
- Local database (SQLite) is the single source of truth — no feature depends on internet
- Scheduled local backup (auto-copy DB file on interval + on shutdown)
- Manual "export backup" button for USB backup

## 6. Non-Functional Requirements

- **Offline:** App must be 100% usable with zero internet connection, indefinitely
- **Performance:** Order screen and printing respond in under 1 second
- **Reliability:** No data loss on crash or power cut (DB writes must be transaction-safe)
- **Hardware compatibility:** Standard thermal receipt printers (USB/Serial/Network), barcode scanner (keyboard-wedge), cash drawer via printer kick port
- **Platform:** Windows primary (most common in restaurant setups); cross-platform via Electron is a bonus, not a requirement

## 7. Technical Architecture

| Layer | Choice |
|---|---|
| Shell | Electron |
| UI | React |
| Database | better-sqlite3 (local, embedded) |
| Printing | node-thermal-printer / escpos |
| Packaging | electron-builder (Windows installer) |
| Backup | Local file copy, scheduled + manual export |

No backend server required for v1. Local-only, single-terminal.

## 8. Out of Scope (v1)

- Online/delivery ordering integration
- Multi-branch / cloud sync
- Customer loyalty or CRM features
- Payment gateway integration (card/wallet payments are recorded, not processed in-app)
- Mobile app / remote access

## 9. Phased Rollout

| Phase | Deliverable |
|---|---|
| 1 | DB schema + menu/catalog CRUD |
| 2 | Sales screen + cart + checkout |
| 3 | Invoice generation + thermal printing |
| 4 | Inventory + recipe-based deduction |
| 5 | Shifts, X/Z reports, cash reconciliation |
| 6 | Backup system + polish + packaging/installer |

## 10. Open Questions

- Restaurant name / branding for receipt header?
- Single counter or multiple terminals expected later?
- Which printer model (for driver/compatibility check)?
- Card/wallet payments — record only, or is a gateway needed later?
