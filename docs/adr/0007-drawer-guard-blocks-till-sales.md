# Drawer guard: block Till sales when no session is open

The Till enforces that a drawer session must be open before any sale can be
completed. All roles — Admin, Manager, Cashier — are subject to the same rule.
An in-progress order completes normally if the drawer closes mid-order; only
subsequent new sales are blocked until a new session is opened.

This is a hard gate, not a warning. The trade-off is operational friction
(managers must remember to open the drawer before the first sale of the day)
in exchange for guaranteed reconciliation data: every sale has a drawer session
attached, and the running balance is always meaningful.

Only cash payments increment the drawer balance; card and digital payments are
excluded because they don't pass through the physical drawer.
