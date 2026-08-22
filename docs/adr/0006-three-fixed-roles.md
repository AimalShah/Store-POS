# Three fixed roles replace flat permission checkboxes

Access control was five unrelated booleans per user (`perm_products/categories/
transactions/users/settings`) — checkbox soup that let any combination exist, froze
permissions into 12-hour JWTs so revocations lagged, silently 403'd cashiers adding
customers, and hardcoded a superuser bypass on id=1. We replace them with three named
Roles picked once per user, with no per-user overrides:

- **Admin** — everything, including the exclusive areas: Team management and Settings.
- **Manager** — Menu, Stock, Reports, Drawer reconciliation, Till, Customers.
- **Cashier** — Till and customer lookup/quick-add only.

PIN login becomes identity-first: the login screen lists team members as tiles; you
tap your name, then enter your PIN — no more anonymous bcrypt iteration over every
user row, and audit entries carry a known actor from the start.

Trade-off accepted: we cannot grant a Cashier report access or revoke a Manager's
menu rights individually. When a real case appears, the answer is a fourth role or a
policy change, not a checkbox — preserving a permission matrix small enough to hold
in one's head. Role is resolved fresh per request rather than trusted from the token,
so revocations take effect immediately.
