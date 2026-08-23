# Store POS - Roles and Permissions

This document describes the three user roles in Store POS and their permissions.

## Roles Overview

| Role | Description |
|------|-------------|
| **Admin** | Full system access including user management, settings, and audit logs |
| **Manager** | Operational management access including inventory, reports, and team oversight |
| **Cashier** | Point-of-sale focused access for processing sales and shift management |

---

## Admin

**Full system administrator access**

### Navigation Access
- Dashboard
- Shift Summary
- Sales
- Customers
- Menu (Products)
- Stock
- Drawer
- Reports
- Team (User Management)
- Settings
- Export
- Printers
- Audit Log

### Permissions
- ✅ Create, edit, delete users (all roles)
- ✅ Manage user PINs and roles
- ✅ Full system settings (store info, tax, theme, till number)
- ✅ View audit logs
- ✅ Configure printers
- ✅ Export data
- ✅ Manage product catalog (create, edit, delete, categories)
- ✅ Manage stock (ingredients, restock, usage, wastage)
- ✅ View all reports
- ✅ Open/close cash drawer
- ✅ View drawer reconciliation reports
- ✅ Void transactions
- ✅ Delete transactions
- ✅ Manage customers
- ✅ Access all API endpoints

---

## Manager

**Operational management access**

### Navigation Access
- Dashboard
- Shift Summary
- Sales
- Customers
- Menu (Products)
- Stock
- Drawer
- Reports
- Team (View only)
- Settings (View only)
- Export
- Printers (View only)
- Audit Log (View only)

### Permissions
- ✅ View team members (cannot create/edit/delete)
- ✅ View system settings (cannot modify)
- ✅ View printer settings (cannot modify)
- ✅ View audit logs (cannot modify)
- ✅ Manage product catalog (create, edit, delete, categories)
- ✅ Manage stock (ingredients, restock, usage, wastage)
- ✅ View all reports
- ✅ Open/close cash drawer
- ✅ View drawer reconciliation reports
- ✅ Void transactions
- ✅ Export data
- ✅ Manage customers
- ✅ Access sales, inventory, and reporting APIs
- ❌ Cannot create/edit/delete users
- ❌ Cannot modify system settings
- ❌ Cannot configure printers

---

## Cashier

**Point-of-sale focused access**

### Navigation Access
- Shift Summary
- Sales
- Customers
- Drawer

### Permissions
- ✅ Process sales at the till
- ✅ View own shift summary (sales, orders, AOV, held orders, payment split)
- ✅ View own held orders
- ✅ Open cash drawer at start of shift (enter float amount)
- ✅ Close cash drawer at end of shift (count and reconcile cash)
- ✅ View drawer session history for own sessions
- ✅ View sales history (own transactions)
- ✅ View customer list
- ✅ Select customers for orders
- ❌ Cannot access Dashboard (management view)
- ❌ Cannot manage products/categories
- ❌ Cannot manage stock/ingredients
- ❌ Cannot view reports
- ❌ Cannot manage team/users
- ❌ Cannot modify settings
- ❌ Cannot configure printers
- ❌ Cannot export data
- ❌ Cannot view audit logs
- ❌ Cannot void/delete transactions (requires Manager+)

---

## Navigation Matrix

| Feature | Admin | Manager | Cashier |
|---------|-------|---------|---------|
| Dashboard | ✅ | ✅ | ❌ |
| Shift Summary | ✅ | ✅ | ✅ |
| Sales | ✅ | ✅ | ✅ |
| Customers | ✅ | ✅ | ✅ |
| Menu (Products) | ✅ | ✅ | ❌ |
| Stock | ✅ | ✅ | ❌ |
| Drawer | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ❌ |
| Team | ✅ | View Only | ❌ |
| Settings | ✅ | View Only | ❌ |
| Export | ✅ | ✅ | ❌ |
| Printers | ✅ | View Only | ❌ |
| Audit Log | ✅ | View Only | ❌ |

---

## API Access by Role

### Admin Only
- `POST /users/post` - Create user
- `DELETE /users/user/:id` - Delete user
- `POST /settings/post` - Save settings
- `POST /printer/settings` - Save printer settings
- `GET /audit-log` - View audit logs
- `POST /inventory/product` - Create product
- `DELETE /inventory/product/:id` - Delete product
- `POST /categories/category` - Create category
- `DELETE /categories/category/:id` - Delete category
- `POST /stock/ingredients` - Create ingredient
- `DELETE /stock/ingredients/:id` - Delete ingredient

### Admin + Manager
- `GET /users/all` - List users
- `GET /settings/get` - Get settings
- `GET /printer/settings` - Get printer settings
- `GET /drawer` - List all drawer sessions
- `GET /drawer/summary` - Drawer reconciliation summary
- `POST /inventory/products/bulk-delete` - Bulk delete products
- `PUT /categories/category` - Update category
- `PUT /stock/ingredients/:id` - Update ingredient

### All Roles (Admin, Manager, Cashier)
- `GET /drawer/open` - Get open drawer session
- `POST /drawer/open` - Open drawer session
- `POST /drawer/:sessionId/close` - Close drawer session
- `GET /on-hold` - Get held orders
- `GET /by-date` - Get transactions by date
- `POST /new` - Create transaction
- `GET /customers/all` - List customers
- `POST /customers/customer` - Create customer
- `PUT /customers/customer` - Update customer
- `GET /inventory/products` - List products
- `GET /categories/all` - List categories

---

## Shift Workflow by Role

### Cashier Shift Workflow
1. **Login** → Lands on Shift Summary page
2. **Start Shift** → Click "End Shift" button → Opens Drawer page
3. **Open Drawer** → Enter float amount → Drawer opens
4. **Process Sales** → Use Till (Quick New Order)
5. **End Shift** → Click "End Shift" → Count cash → Close drawer
6. **Shift Complete** → Returns to Shift Summary

### Manager Shift Workflow
1. **Login** → Chooses Dashboard or Till
2. **Dashboard** → Overview of all shifts, sales, stock
3. **Drawer Management** → Can open/close any till drawer
4. **Reports** → View detailed reports for any period
5. **Team Oversight** → View all cashier shifts

### Admin Shift Workflow
1. **Login** → Full access to all features
2. **System Setup** → Configure store, printers, tax
3. **User Management** → Create cashiers, managers
4. **Audit Trail** → Review all system actions

---

## Default Navigation by Role

### Cashier Default View
- **Shift Summary** (first page after login)
- Accessible via sidebar: Shift Summary, Sales, Customers, Drawer

### Manager Default View
- **Dashboard** (first page after login)
- Accessible via sidebar: All except Team/Settings/Export/Printers/Audit Log (view only)

### Admin Default View
- **Dashboard** (first page after login)
- Accessible via sidebar: All features

---

## Security Notes

- Role is verified from database on every API request (not trusted from token)
- Role changes take effect on next request
- Cashiers cannot access management APIs even if they know the endpoints
- All drawer operations are logged in audit trail
- PIN-based login available for quick cashier access