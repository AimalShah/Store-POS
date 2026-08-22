# Store POS

Offline desktop point-of-sale for a single-register fast food restaurant. Cashiers take orders at the till, collect payment, and print receipts; managers run the menu, inventory, reports, and settings.

## Language

### Roles

**Role**:
One of three fixed access levels — Admin, Manager, Cashier — that decides what a team member can do. Replaces per-user permission checkboxes; there are no per-user overrides.
_Avoid_: permission set, access level

**Admin**:
A team member with unrestricted access, including the two exclusive areas: Team management and Settings.
_Avoid_: superuser, owner, boss

**Manager**:
A team member who runs the day-to-day — Menu, Stock, Reports, and Drawer reconciliation — plus everything a Cashier can do. Cannot manage Team or Settings.
_Avoid_: supervisor, shift lead

**Cashier**:
A team member who works the Till: builds orders, takes payment, looks up or quick-adds customers. Nothing else.
_Avoid_: staff, user, employee

### Ordering

**Till**:
The order-taking screen where cashiers build orders and process payment.
_Avoid_: Order/Sales screen

**Order**:
A basket of items being built at the till, or a held/parked order waiting to resume. Not yet paid; has no invoice number yet.
_Avoid_: Transaction, ticket

**Sale**:
A completed order that was paid and received its sequential invoice number. Sales never touch Stock.
_Avoid_: Transaction, purchase

**Menu**:
The staff-facing name for the product catalog — both the management screen where items are created/edited and the till's product grid where cashiers ring up orders. A single concept with two surfaces.
_Avoid_: Catalog, Products

**Product**:
A sellable menu item in the catalog (e.g. Zinger Burger, small pizza). The unit a cashier rings up.
_Avoid_: Item

**Item**:
A line on an order — one product with a quantity and optional note.
_Avoid_: Product

**Section**:
A grouping of menu items shown as a tab on the till (e.g. Burgers, Drinks, Starters). The unit products are organised and filtered by. Formerly labelled "Category" in code and UI.
_Avoid_: Category, group

**Kitchen ticket (KOT)**:
The kitchen-facing printout generated when an order is completed. Carries item lines and notes only — no prices and no customer details. Distinct from the customer-facing Receipt; both print on a completed sale.
_Avoid_: using "KOT" alone without defining it first

**Fulfillment**:
How an order is handed to the customer — one of `dine-in`, `takeaway`, or `delivery`. A property of the Order (and carried onto the Sale), distinct from payment type. Every order carries a Customer, defaulting to Walk-in. `delivery` cannot complete without a chosen Customer or one-time contact details (name, phone, address); `dine-in` and `takeaway` may stay Walk-in or optionally attach a Customer.
_Avoid_: order type, service type, dining option

**Customer**:
A saved person in the customers book — name and phone, optionally email/address — attachable to an Order. Distinct from one-time delivery details, which live on the Sale only and are never saved.
_Avoid_: client, guest, account

**Walk-in**:
The anonymous default Customer attached to any order where no real customer was chosen.
_Avoid_: guest checkout

**Variant**:
A single-choice attribute of a Product that alters its price (e.g. Size: Small/Medium/Large). A Product carries EITHER one base price OR variant prices — never both; adding the first variant replaces the base price. When variants exist, exactly one must be selected before the item is added, and each variant carries its own cost as well as price.
_Avoid_: option, size

**Modifier** (a.k.a. topping):
A multi-choice add-on to a Product, each with its own price, applied on top of the base (e.g. extra cheese, mushrooms). Zero or more may be selected. Distinct from a Variant, which replaces the base configuration rather than adding to it.
_Avoid_: topping (use only as the common example)

**Stock**:
The ingredient inventory ledger — running balances of raw goods (dough, cheese, eggs), maintained entirely by manual entries: Restocks add, Usage entries and Wastage deduct. Managed daily by the admin; sales never touch it.
_Avoid_: product stock, on-hand product quantity

**Ingredient**:
A raw good tracked in Stock with its own unit of measure (e.g. kg, pieces, litres). Consumed in the kitchen, never sold — distinct from a Product, which is what appears on the till.
_Avoid_: stock item, raw material

**Restock**:
A Stock entry that adds received quantity to an ingredient's balance when goods arrive.
_Avoid_: purchase, delivery (in the fulfillment sense)

**Usage entry**:
A manual deduction from an ingredient's balance recording consumption, typed by the admin at end of day (e.g. "3 dough used").
_Avoid_: sale deduction, auto-deduct

**Wastage**:
A deduction from an ingredient's balance for spoiled, expired, or lost goods, recorded with a reason (e.g. "4 eggs wasted").
_Avoid_: loss, write-off

**Combo**:
A product sold at a bundle price that carries an informational list of component products (printed on the receipt). Components are not stock-linked.

**Hot Item**:
A Product manually flagged `hot` by a manager in the catalog to surface it as a promoted/daily-special in the till's "Hot & Best Sellers" tab. Curated, instant, not derived from sales.
_Avoid_: featured, popular

**Best Seller**:
A Product ranked into the till's "Hot & Best Sellers" tab by a computed top-N over historical sales (units sold in the trailing window, e.g. last 30 days). Derived, shifts as sales data changes.
_Avoid_: top product, popular item

**Receipt**:
The customer-facing document generated when an order is completed. Carries the sequential invoice number and prints on thermal (58/80mm) or PDF/A4.

**Invoice**:
The formal A4/PDF document used for reprints and exports, with the sequential invoice number.
_Avoid_: Bill

**Cost per item**:
The per-unit purchase/prep cost recorded against a Product. For products with variants (sizes), cost is recorded **per variant**, not per product, so margin is correct for each size sold. Enables profit and margin reporting. Off until a value is entered.
_Avoid_: COGS, expense

**Profit**:
Revenue from a Sale minus the summed Cost of the items sold. Derived, not stored.
_Avoid_: earnings, income

**Margin**:
Profit expressed as a percentage of a Sale's revenue. Derived from Profit and total.
_Avoid_: markup, margin percent

**Cash drawer reconciliation**:
A lightweight open/close count of the till — an opening float, a counted closing cash figure, and the variance versus system-expected cash. Replaces the former Shift / X-report / Z-report model: there are no formal shift periods, just a daily drawer count to catch till shortages.
_Avoid_: Shift, X report, Z report, Day report
