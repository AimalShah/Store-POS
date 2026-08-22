import { buildNavGroups, canAccess, resolveInitialView } from '../src/lib/nav';

const ids = (role) => buildNavGroups(role).flatMap((g) => g.items.map((i) => i.id));

describe('Role-based navigation (ADR-0006 matrix)', () => {
  test('groups items into Overview / Sales / Inventory / Administration', () => {
    const groups = buildNavGroups('Admin');
    expect(groups.map((g) => g.label)).toEqual([
      'Overview',
      'Sales',
      'Inventory',
      'Administration',
    ]);
  });

  test('cashiers see only Till/Sales, Customers and Dashboard', () => {
    const cashierIds = ids('Cashier');
    expect(cashierIds).toContain('sales');
    expect(cashierIds).toContain('customers');
    expect(cashierIds).toContain('dashboard');
    expect(cashierIds).not.toContain('menu');
    expect(cashierIds).not.toContain('reports');
    expect(cashierIds).not.toContain('drawer');
    expect(cashierIds).not.toContain('team');
    expect(cashierIds).not.toContain('settings');
  });

  test('managers additionally see Menu, Reports and Drawer — never Team or Settings', () => {
    const managerIds = ids('Manager');
    expect(managerIds).toEqual(expect.arrayContaining(['menu', 'stock', 'reports', 'drawer']));
    expect(managerIds).not.toContain('team');
    expect(managerIds).not.toContain('settings');
    expect(managerIds).not.toContain('export');
    expect(managerIds).not.toContain('audit-log');
  });

  test('only admins see Team, Settings, Export, Printers and Audit Log', () => {
    const adminIds = ids('Admin');
    expect(adminIds).toEqual(expect.arrayContaining(['team', 'settings', 'export', 'printers', 'audit-log']));
  });

  test('canAccess matches the visible nav exactly', () => {
    expect(canAccess('Cashier', 'sales')).toBe(true);
    expect(canAccess('Cashier', 'menu')).toBe(false);
    expect(canAccess('Manager', 'reports')).toBe(true);
    expect(canAccess('Manager', 'team')).toBe(false);
    expect(canAccess('Admin', 'team')).toBe(true);
  });

  test('initial view is always the Dashboard (Overview is first)', () => {
    expect(resolveInitialView(buildNavGroups('Cashier'))).toBe('dashboard');
    expect(resolveInitialView(buildNavGroups('Admin'))).toBe('dashboard');
  });

  test('Shifts is no longer offered in the sidebar', () => {
    expect(ids('Admin')).not.toContain('shifts');
  });
});
