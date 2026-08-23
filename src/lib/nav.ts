export type Role = 'Admin' | 'Manager' | 'Cashier';

export type NavItemId =
  | 'dashboard'
  | 'shift-summary'
  | 'sales'
  | 'customers'
  | 'menu'
  | 'stock'
  | 'drawer'
  | 'reports'
  | 'team'
  | 'settings'
  | 'export'
  | 'printers'
  | 'audit-log';

// ADR-0006 matrix: which roles may see each navigation area.
const ROLE_AREAS: Record<NavItemId, Role[]> = {
  dashboard: ['Admin', 'Manager'],
  'shift-summary': ['Cashier'],
  sales: ['Admin', 'Manager', 'Cashier'],
  customers: ['Admin', 'Manager', 'Cashier'],
  menu: ['Admin', 'Manager'],
  stock: ['Admin', 'Manager'],
  drawer: ['Admin', 'Manager', 'Cashier'],
  reports: ['Admin', 'Manager'],
  team: ['Admin'],
  settings: ['Admin'],
  export: ['Admin'],
  printers: ['Admin'],
  'audit-log': ['Admin'],
};

export type NavItem = { id: NavItemId; label: string; icon: string };
export type NavGroup = { id: string; label: string; items: NavItem[] };

type NavDef = {
  group: string;
  label: string;
  items: { id: NavItemId; label: string; icon: string }[];
};

const NAV: NavDef[] = [
  {
    group: 'overview',
    label: 'Overview',
    items: [
      { id: 'shift-summary', label: 'Shift Summary', icon: 'LayoutDashboard' },
      { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3' },
    ],
  },
  {
    group: 'sales',
    label: 'Sales',
    items: [
      { id: 'sales', label: 'Sales', icon: 'ReceiptText' },
      { id: 'reports', label: 'Reports', icon: 'BarChart3' },
    ],
  },
  {
    group: 'inventory',
    label: 'Inventory',
    items: [
      { id: 'menu', label: 'Menu', icon: 'Package' },
      { id: 'stock', label: 'Stock', icon: 'Warehouse' },
      { id: 'customers', label: 'Customers', icon: 'Users' },
    ],
  },
  {
    group: 'administration',
    label: 'Administration',
    items: [
      { id: 'drawer', label: 'Drawer', icon: 'Timer' },
      { id: 'team', label: 'Team', icon: 'UserCog' },
      { id: 'settings', label: 'Settings', icon: 'Settings' },
      { id: 'export', label: 'Export', icon: 'Download' },
      { id: 'printers', label: 'Printers', icon: 'Printer' },
      { id: 'audit-log', label: 'Audit Log', icon: 'AlertTriangle' },
    ],
  },
];

export function buildNavGroups(role: Role): NavGroup[] {
  return NAV.map((g) => ({
    id: g.group,
    label: g.label,
    items: g.items.filter((i) => ROLE_AREAS[i.id].includes(role)),
  })).filter((g) => g.items.length > 0);
}

export function canAccess(role: Role, id: NavItemId): boolean {
  return ROLE_AREAS[id]?.includes(role) ?? false;
}

export function resolveInitialView(groups: NavGroup[]): NavItemId {
  return groups[0]?.items[0]?.id ?? 'dashboard';
}
