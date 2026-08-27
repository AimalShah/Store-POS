# Per-user locale preference stored in the database

Language preference (English or Urdu) is saved as a `locale` column on the user
table. The preference follows the user across terminals — Cashier A always sees
Urdu, Cashier B always sees English, regardless of which machine they log in
from.

We chose database storage over localStorage because this is a multi-terminal
desktop app where the same user may log in from different machines.
localStorage is per-device and would force re-selection on each terminal. A
database column is a one-column migration and matches the existing pattern for
user-scoped settings.

Urdu triggers full RTL layout: `dir="rtl"` on `<html>`, sidebar on the right,
text right-aligned. English uses standard LTR. Product names and catalog data
are not translated — they stay in whatever language the manager entered, as do
Receipt and KOT printouts.

Scope: all hardcoded UI strings (button labels, page titles, navigation, error
messages, tooltips) are translated. Product names and catalog content are not.
