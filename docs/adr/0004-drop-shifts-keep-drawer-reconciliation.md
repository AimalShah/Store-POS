# Drop Shifts, keep a lightweight cash-drawer reconciliation

The Shift feature bundled two separable jobs: period framing for X/Z reports and
cash reconciliation (opening float + counted closing cash + variance). We removed
the formal "shift" concept and its X/Z-report terminology because staff found the
overhead pointless, but kept cash reconciliation as a simple daily drawer
open/close count. This was a deliberate trade-off — we accept losing per-period
sales snapshots in exchange for a less burdensome till workflow, retaining only
the theft/error detection that justified shifts in the first place.
