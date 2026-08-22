# Stock is a manual ingredient ledger, not product quantities

The original stock model attached quantity to Products: a per-product tracking flag,
sale-time deduction, void restoration, low-stock thresholds, an out-of-stock overlay
on till cards, and a product-movement history. In practice the restaurant's inventory
problem is raw goods — dough, cheese, eggs — counted in bulk and adjusted by hand,
not sellable units decrementing per sale. We replace the entire product-stock machinery
with an **ingredient ledger**: each Ingredient has one unit from a fixed list
(pcs/kg/g/L/ml) and a balance moved only by manual entries — Restocks add, Usage
entries and Wastage deduct. Sales never touch stock. The Stock screen is tabbed:
Restock (goods-in) and Manage (balance table with usage/wastage logging, editing,
and history), accessible to Admin and Manager roles.

Two capabilities were deliberately dropped and must not be quietly reintroduced:

- **No recipe explosion** — selling a pizza deducts nothing automatically. Recipes
  linking Products to Ingredients (and a hybrid of both) were considered and rejected:
  heavy setup for every menu item plus a second source of truth to reconcile daily.
- **No availability/sold-out concept** — nothing greys out till cards when supplies
  run dry. Running out is handled socially or by hiding the product in the Menu.

Trade-off accepted: stock accuracy depends entirely on staff discipline at end of day;
in exchange there is zero bookkeeping during service and one meaning of "stock".
