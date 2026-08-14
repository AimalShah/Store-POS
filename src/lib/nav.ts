export type NavItemId =
  | 'dashboard'
  | 'catalog'
  | 'sales'
  | 'customers'
  | 'menu'
  | 'drawer'
  | 'reports'
  | 'shifts'
  | 'team'
  | 'settings'
  | 'export'
  | 'printers'
  | 'stock-history';

export type Permissions = {
  perm_products: number;
  perm_categories: number;
  perm_transactions: number;
  perm_users: number;
  perm_settings: number;
};

export type NavItem = { id: NavItemId; label: string; icon: string };
export type NavGroup = { id: string; label: string; items: NavItem[] };

type NavDef = {
  group: string;
  label: string;
  items: {
    id: NavItemId;
    label: string;
    icon: string;
    show: (p: Permissions) => boolean;
  }[];
};

const NAV: NavDef[] = [
  {
    group: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', show: () => true },
    ],
  },
  {
    group: 'sales',
    label: 'Sales',
    items: [
      { id: 'sales', label: 'Sales', icon: 'ReceiptText', show: (p) => Boolean(p.perm_transactions) },
      { id: 'shifts', label: 'Shifts', icon: 'Timer', show: (p) => Boolean(p.perm_transactions) },
      { id: 'reports', label: 'Reports', icon: 'BarChart3', show: (p) => Boolean(p.perm_transactions) },
    ],
  },
  {
    group: 'inventory',
    label: 'Inventory',
    items: [
      {
        id: 'menu',
        label: 'Menu',
        icon: 'Package',
        show: (p) => Boolean(p.perm_products) || Boolean(p.perm_categories),
      },
      { id: 'stock-history', label: 'Stock History', icon: 'Warehouse', show: (p) => Boolean(p.perm_products) },
      { id: 'customers', label: 'Customers', icon: 'Users', show: () => true },
    ],
  },
  {
    group: 'administration',
    label: 'Administration',
    items: [
      { id: 'team', label: 'Team', icon: 'UserCog', show: (p) => Boolean(p.perm_users) },
      { id: 'settings', label: 'Settings', icon: 'Settings', show: (p) => Boolean(p.perm_settings) },
      { id: 'export', label: 'Export', icon: 'Download', show: (p) => Boolean(p.perm_settings) },
      { id: 'printers', label: 'Printers', icon: 'Printer', show: (p) => Boolean(p.perm_settings) },
    ],
  },
];

export function buildNavGroups(p: Permissions): NavGroup[] {
  return NAV.map((g) => ({
    id: g.group,
    label: g.label,
    items: g.items
      .filter((i) => i.show(p))
      .map((i) => ({ id: i.id, label: i.label, icon: i.icon })),
  })).filter((g) => g.items.length > 0);
}

export function resolveInitialView(groups: NavGroup[]): NavItemId {
  return groups[0]?.items[0]?.id ?? 'dashboard';
}
