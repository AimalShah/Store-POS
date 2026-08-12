# Store POS

Offline desktop point-of-sale for a single-register fast food restaurant. Cashiers take orders at the till, collect payment, and print receipts; managers run catalog, inventory, reports, shifts, and settings.

## Language

**Till**:
The order-taking screen where cashiers build orders and process payment.
_Avoid_: Order/Sales screen

**Order**:
A basket of items being built at the till, or a held/parked order waiting to resume. Not yet paid; has no invoice number yet.
_Avoid_: Transaction, ticket

**Sale**:
A completed order that was paid, received its sequential invoice number, and deducted stock.
_Avoid_: Transaction, purchase

**Product**:
A sellable menu item in the catalog (e.g. Zinger Burger, small pizza). The unit a cashier rings up.
_Avoid_: Item

**Item**:
A line on an order — one product with a quantity and optional note.
_Avoid_: Product

**Stock**:
The on-hand sellable quantity of a product, optionally tracked. Off by default because most food is cooked to order; turned on per product (e.g. chicken) when pre-stocked goods matter.

**Stock movement**:
A logged change to a product's stock — a sale deduction, a restock, or a wastage write-off with a reason.

**Combo**:
A product sold at a bundle price that carries an informational list of component products (printed on the receipt). Components are not stock-linked.

**Receipt**:
The customer-facing document generated when an order is completed. Carries the sequential invoice number and prints on thermal (58/80mm) or PDF/A4.

**Invoice**:
The formal A4/PDF document used for reprints and exports, with the sequential invoice number.
_Avoid_: Bill

**Cost (COGS)**:
The per-unit purchase/prep cost recorded against a Product. Enables profit and margin reporting. Off until a value is entered.
_Avoid_: price, expense

**Profit**:
Revenue from a Sale minus the summed Cost of the items sold. Derived, not stored.
_Avoid_: earnings, income

**Margin**:
Profit expressed as a percentage of a Sale's revenue. Derived from Profit and total.
_Avoid_: markup, margin percent

**Shift**:
A period of till activity opened by a user with a starting cash float, closed with a counted cash total and reconciliation.

**X report**:
A mid-shift, no-reset snapshot of sales so far (by payment method, item counts).

**Z report**:
The shift-close document with full totals and cash reconciliation. Marks the shift closed.
_Avoid_: Day report
