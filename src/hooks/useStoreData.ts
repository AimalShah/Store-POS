import { useCallback, useEffect, useState } from 'react';
import { api, Category, Customer, Product, Settings } from '../api/client';

export function useStoreData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [p, c, cust, s] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getCustomers(),
        api.getSettings(),
      ]);
      setProducts(p);
      setCategories(c);
      setCustomers(cust);
      setSettings(s.settings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load store data');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { products, categories, customers, settings, error, reload };
}
