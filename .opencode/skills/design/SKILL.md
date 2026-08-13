---
name: design
description: Store POS UI rules. Use ONLY before writing any UI code in this repo — shadcn/ui exclusively, components installed via the official shadcn CLI, light theme, admin-dashboard shell, full-screen till. Do not hand-write CSS or pull components from any third-party kit.
---

# Store POS Design System

This skill is the single source of truth for how Store POS looks and how UI code must be written. It applies to every page, dialog, form, table, and screen in this repo — the till, the management portal, and anything added later.

It is a **constraint**, not a suggestion. Code that violates it is not acceptable.

## The two hard rules

1. **shadcn/ui exclusively.** Every visible UI element must come from a shadcn component (registry component or a component composed from them). Nothing else.
2. **Official CLI only.** Components are added with the official shadcn CLI — `npx shadcn@latest add <component>` — which vendors them into `src/components/ui/`. Never hand-copy a component from a website, blog, or third-party kit.

### Allowed

- shadcn registry components (via `npx shadcn@latest add …`)
- Components composed from shadcn primitives (e.g. a `ProductCard` built from `Card` + `Button`)
- `lucide-react` icons (the icon set shadcn uses)
- Tailwind CSS (shadcn's base) and the shadcn CSS variables (`--background`, `--primary`, …)
- Radix primitives already bundled inside shadcn components
- `recharts` for charts (via the shadcn `chart` component)
- `react-hook-form` + `zod` for forms (via the shadcn `form` component)

### Prohibited

- Any other component library: MUI, Ant Design, Chakra, shadcnspace, Tailwind UI, etc.
- **Hand-written CSS files** — this is a rewrite away from the old 987-line `index.css`. No `className` soup with bespoke utility values; no custom `styles.css`; no CSS-in-JS libraries.
- Bespoke styled components built with raw utility classes outside the shadcn token system.
- Google Fonts, CDNs, or any network dependency — the app runs **fully offline**. Fonts ship as local npm packages.
- Copying components from shadcnspace or any other third-party component kit.

## Design tokens

**Theme:** light-only (counter POS under bright lighting). Dark mode is out of scope.

**Neutrals:** zinc.

**Primary / accent:** orange (`oklch(0.646 0.222 41.116)` ≈ `#EA580C`, orange-600) — warm, appetite-friendly, suits a fast-food register. Use the shadcn CSS variable (`bg-primary`, `text-primary-foreground`), never a hardcoded hex in JSX.

**Radius:** `0.5rem` (shadcn default).

**Font:** Inter (Variable), installed locally via `@fontsource-variable/inter` and wired through Tailwind. Inter is the shadcn-space dashboard standard; it must load with no network.

**Spacing & scale:** Tailwind default scale. Cards use `p-6`; page content `gap-6`; the till grid `gap-3`.

## Layout system — two portals

The app is split into two experiences reached from a **launcher home screen** (two large buttons). Permission-aware: a user only sees portals they may enter.

### 1. Order & Billing (the till)

- **Full-screen, immersive, no sidebar.** Maximise the product grid.
- Product grid (category chips + product tiles) on the left, cart panel on the right.
- Touch-first: buttons ≥ `h-12`, `text-base`; generous hit areas; keyboard shortcuts preserved.
- The cart is a `Card` with a fixed footer for totals and the pay button.

### 2. Management portal (dashboard)

- shadcnspace-style **`Sidebar` shell**: collapsible sidebar grouped into **Register** (no — the till lives in its own portal) and **Management** groups. Nav items: Dashboard, Catalog, Sales, Customers, Reports, Shifts, Team, Settings.
- `SidebarProvider` + `SidebarInset` with a `SidebarTrigger` in a `SidebarHeader`/topbar.
- Views are state-switched (`NavView`), not routed — no react-router.
- Management views render only when the user has the matching permission.

## Component usage conventions

- **Data grids/tables:** shadcn `Table`, or `DataTable` (TanStack) for anything with sorting/pagination.
- **Forms:** shadcn `Form` (react-hook-form + zod) inside a `Card` or `Dialog`. Validation messages inline.
- **Dialogs:** shadcn `Dialog` (never hand-rolled modals — the old `Modal.tsx` is gone).
- **Feedback:** shadcn `Toast` (sonner) for success/error; never `window.alert`/`confirm`.
- **Empty states:** shadcn `Card` + `Button` — a short message and a clear next action. Never a bare grid.
- **Status:** shadcn `Badge` for out-of-stock, held, shift state, etc.
- **Charts:** shadcn `Chart` (recharts), used on the Dashboard.
- **Icons:** lucide-react, consistent size/weight (default `size-4`, `size-5` on buttons).
- **Action buttons use icons, not words.** Where a lucide icon unambiguously represents the action (print, edit, delete/trash, refresh/reload, download, save, plus/add, filter, search, close, copy, settings/gear, log-out), render the icon — not a text label. Keep a short text label only when an icon would be ambiguous or the action needs emphasis (e.g. a primary "Pay" button). Icon-only action buttons must carry an `aria-label` (and ideally a `Tooltip`) so they stay accessible. Do not spell out "Print", "Edit", "Delete", etc. in button text when an icon conveys it.

## States

- **Out of stock** (stock-tracked product at 0): tile stays on the grid, dimmed, with an "Out of stock" `Badge` — never hidden.
- **Loading:** shadcn `Skeleton`; never a raw "Loading…" string.
- **Destructive:** `destructive` variant `Button`, and destructive confirmations via `AlertDialog`.

## Working with the CLI

```bash
npx shadcn@latest init          # already done — do not re-init
npx shadcn@latest add button card sidebar dialog table form chart ...
```

- Keep shadcn at its **official, latest** version. Never fork or edit `components.json`.
- New components land in `src/components/ui/`. Build product components (e.g. `ProductTile`, `CartPanel`, `PaymentPad`) in `src/components/` on top of them.
- After the first install in a fresh checkout, the config is already set: Tailwind v4 + CSS variables in the global stylesheet. Keep it that way.

## Review checklist

- [ ] Every element is a shadcn component or composed from one
- [ ] No CSS files written by hand; no raw utility-class styling outside tokens
- [ ] No third-party UI kit or copied component
- [ ] Light theme, zinc neutrals, orange primary, Inter font
- [ ] Buttons ≥ `h-12` on the till; management UI uses standard `h-9`/`h-10`
- [ ] Action buttons use icons, not words, where an icon is unambiguous (`aria-label` + optional tooltip present)
- [ ] Account/dropdown triggers show a chevron (`ChevronDown`/`ChevronsUpDown`) affordance
- [ ] No `alert()`/`confirm()`, no hand-rolled modal
