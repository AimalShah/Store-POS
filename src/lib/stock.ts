import type { Product } from '../api/client';

export function isLowStock(product: Product): boolean {
  if (!product.trackStock) return false;
  const threshold = product.lowStockThreshold ?? 10;
  const qty = product.quantity ?? 0;
  return qty >= 0 && qty <= threshold;
}

export function getLowStockThreshold(product: Product): number {
  return product.lowStockThreshold ?? 10;
}

export function getStockQuantity(product: Product): number {
  return product.quantity ?? 0;
}