# Fulfillment, Variant & Modifier model for the till

The till previously had no order-type concept and a flat `Product` (single price, no choices). We are adding three linked domain concepts to support the real restaurant order flow from `docs/POS-TILL-DESIGN.md`:

- **Fulfillment** — a property of the Order (carried onto the Sale), one of `dine-in | takeaway | delivery`. `takeaway` is the default and resets per new order. `delivery` captures name + contact number + address; `dine-in` captures nothing for now (table number deferred).
- **Variant** — single-choice, *required* attribute groups on a Product (e.g. Size, Spice), each option with a price delta. A Product may have zero or more variant groups. Products with none add instantly with no popup.
- **Modifier** (topping) — multi-choice, *optional* add-ons on a Product, each with a price delta, applied on top of the base.

When a Product has variants and/or modifiers, clicking it opens a selection popup; the chosen `variantSelections` and `modifiers` are stored on the cart **Item**, the line price is recomputed as `base + Σ variant deltas + Σ modifier deltas`, and both are persisted on the saved `Transaction` and printed on the receipt. This keeps recognition-first UI (compact tiles, only-prompt-when-needed) while moving the data model from flat to choice-aware.

Deferred (explicit no-s): dine-in table numbers, per-topping quantity (e.g. double cheese), and variant/modifier management UI in the catalog — each is a separate follow-up.

## Addendum (2026-08-22): either/or price rule for variants

The "zero or more variant groups" framing above proved confusing in the product form,
where a base price and per-size prices coexisted as two competing sources of truth
(the till silently preferred size prices; cards always showed base). Superseding rule:
a Product carries **either one base price or variant prices — never both**; adding the
first variant replaces the base price in the form. Variants carry absolute prices (not
deltas) and, like simple products, each also carries its own **cost** so margin is
correct per size (`product_sizes.cost` existed but was never editable before this).
Till cards show "From £<cheapest variant>" when sized. See CONTEXT.md **Variant**.

