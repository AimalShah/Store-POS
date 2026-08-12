import { buildNavGroups, resolveInitialView } from '../src/lib/nav';

const perms = (over = {}) => ({
  perm_products: 0,
  perm_categories: 0,
  perm_transactions: 0,
  perm_users: 0,
  perm_settings: 0,
  ...over,
});

describe('Dashboard navigation', () => {
  test('groups items into Overview / Sales / Inventory / Administration', () => {
    const groups = buildNavGroups(
      perms({
        perm_products: 1,
        perm_categories: 1,
        perm_transactions: 1,
        perm_users: 1,
        perm_settings: 1,
      })
    );
    expect(groups.map((g) => g.label)).toEqual([
      'Overview',
      'Sales',
      'Inventory',
      'Administration',
    ]);
  });

  test('hides nav items the user lacks permission for', () => {
    const groups = buildNavGroups(perms({ perm_transactions: 1 }));
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toContain('sales');
    expect(ids).not.toContain('catalog');
    expect(ids).not.toContain('team');
  });

  test('Dashboard and Customers are always visible', () => {
    const groups = buildNavGroups(perms());
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toContain('dashboard');
    expect(ids).toContain('customers');
    expect(ids).not.toContain('sales');
  });

  test('Catalog requires products OR categories permission', () => {
    expect(
      buildNavGroups(perms({ perm_categories: 1 }))
        .flatMap((g) => g.items.map((i) => i.id))
        .includes('catalog')
    ).toBe(true);
  });

  test('initial view is always the Dashboard (Overview is first)', () => {
    expect(resolveInitialView(buildNavGroups(perms({ perm_transactions: 1 })))).toBe('dashboard');
    expect(resolveInitialView(buildNavGroups(perms()))).toBe('dashboard');
  });
});
