const TOKEN_KEY = 'pos_token';
const USER_KEY = 'pos_user';

export type Role = 'Admin' | 'Manager' | 'Cashier';

export const UNITS = ['pcs', 'kg', 'g', 'L', 'ml'] as const;
export type Unit = (typeof UNITS)[number];

export type Ingredient = {
  id: number;
  name: string;
  unit: Unit;
  balance: number;
  costPerUnit: number;
  value: number;
  entryCount: number;
  lastEntry: {
    type: string;
    quantity: number;
    note: string;
    userName: string;
    createdAt: string;
  } | null;
};

export type StockEntry = {
  id: number;
  ingredientId: number;
  ingredientName?: string;
  unit?: string;
  type: 'restock' | 'usage' | 'wastage';
  quantity: number;
  note: string;
  userId: number;
  userName: string;
  createdAt: string;
};

export type User = {
  _id: number;
  id: number;
  username: string;
  fullname: string;
  has_pin?: boolean;
  role: Role;
  status?: string;
  locale?: 'en' | 'ur';
};

export type Product = {
  _id: number;
  id: number;
  name: string;
  price: number;
  cost: number;
  category: string;
  category_id: number | null;
  img: string;
  hot: boolean;
  featureAsDailySpecial: boolean;
  quantity?: number;
  stock?: number;
  trackStock?: boolean;
  lowStockThreshold?: number;
  components?: ProductComponent[];
  sizes?: ProductSize[];
  modifiers?: ModifierGroup[];
};

export type ProductSize = {
  id?: number;
  name: string;
  price: number;
  cost: number;
  position?: number;
};

export type ProductComponent = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

export type VariantOption = { name: string; priceDelta: number };
export type VariantGroup = { name: string; options: VariantOption[] };
export type ModifierOption = { name: string; priceDelta: number };
export type ModifierGroup = { name: string; options: ModifierOption[] };
export type SelectedVariant = { group: string; name: string; priceDelta: number };
export type SelectedModifier = { name: string; priceDelta: number };

export type DrawerSession = {
  id: number;
  till: number;
  floatAmount: number;
  countedCash: number | null;
  variance: number | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
  userId?: number;
  userName?: string;
};

export type AuditLog = {
  id: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  oldValue: unknown | null;
  newValue: unknown | null;
  createdAt: string;
};

export type AuditLogResponse = {
  logs: AuditLog[];
  total: number;
};

export type Category = {
  _id: number;
  id: number;
  name: string;
  icon: string;
  color: string;
};

export type Customer = {
  _id: string;
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
};

export type Settings = {
  app: string;
  store: string;
  address_one: string;
  address_two: string;
  contact: string;
  tax: string;
  symbol: string;
  percentage: number;
  charge_tax: boolean;
  footer: string;
  img: string;
  till: number;
  theme?: string;
};

export type PrinterSettings = {
  interface: '' | 'usb' | 'network';
  usbDevice: string;
  networkHost: string;
  networkPort: number;
  width: 58 | 80;
  kotInterface: '' | 'usb' | 'network';
  kotUsbDevice: string;
  kotNetworkHost: string;
  kotNetworkPort: number;
  kotWidth: 58 | 80;
  autoPrintKot: boolean;
};

export type MediaItem = {
  id: number;
  filename: string;
  path: string;
  source: string;
  photographer: string;
  alt: string;
  created_at: string;
};

export type CartItem = {
  id: number;
  name: string;
  price: number;
  basePrice?: number;
  quantity: number;
  cost?: number;
  categoryId?: number;
  categoryName?: string;
  note?: string;
  discountType?: 'flat' | 'percent';
  discountValue?: number;
  components?: ProductComponent[];
  selectedVariants?: SelectedVariant[];
  selectedModifiers?: SelectedModifier[];
};

export type Transaction = {
  _id: number;
  id: number;
  ref_number: string;
  customer: string;
  customer_name: string;
  status: number;
  user_id: number;
  user: string;
  till: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  change: number;
  payment_type: number;
  payment_breakdown?: { method: string; amount: number; tendered?: number }[];
  items: CartItem[];
  date: string;
  shift_id?: number;
  fulfillment?: 'dine-in' | 'takeaway' | 'delivery';
  delivery_name?: string;
  delivery_contact?: string;
  delivery_address?: string;
};

export type Shift = {
  id: number;
  userId: number;
  userName: string;
  till: number;
  floatAmount: number;
  countedCash?: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  xReport?: XReport | null;
  zReport?: ZReport | null;
};

export type XReport = {
  totalSales: number;
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  saleCount: number;
  transactionCount: number;
  refundCount: number;
  refundTotal: number;
};

export type ZReport = {
  totalSales: number;
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  saleCount: number;
  transactionCount: number;
  refundCount: number;
  refundTotal: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
};

export type ReportSummary = {
  summary: {
    saleCount: number;
    itemsSold: number;
    subtotal: number;
    discount: number;
    tax: number;
    totalSales: number;
  };
  byCategory: { category: string; count: number; revenue: number }[];
  byPaymentMethod: { method: string; count: number; amount: number }[];
  bestSellers: { productId: number | null; name: string; quantity: number; revenue: number }[];
};

export type BestSeller = {
  id: number | null;
  name: string;
  quantity: number;
  revenue: number;
};

let baseUrl = 'http://127.0.0.1:8001/api';

export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/$/, '');
}

export function getBaseUrl() {
  return baseUrl;
}

export function getUploadsBase() {
  return baseUrl.replace(/\/api$/, '') + '/uploads';
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as User;
    // Sessions saved before the roles upgrade carry perm_* fields and no role —
    // treat them as signed out so the shell never renders with a missing role.
    if (!user?.role) return null;
    return user;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export async function healthCheck(healthUrl: string) {
  const res = await fetch(healthUrl, { method: 'GET' });
  if (!res.ok) throw new Error('Server unreachable');
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ user: User; token: string }>(
      '/users/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      false
    ),

  loginByPin: (userId: number, pin: string) =>
    request<{ user: User; token: string }>(
      '/users/login-pin',
      { method: 'POST', body: JSON.stringify({ userId, pin }) },
      false
    ),

  getPinUsers: () =>
    request<{ id: number; fullname: string; role: Role }[]>('/users/pin-users', {}, false),

  getIngredients: () => request<Ingredient[]>('/stock/ingredients'),

  createIngredient: (body: { name: string; unit: Unit; costPerUnit?: number }) =>
    request<Ingredient>('/stock/ingredients', { method: 'POST', body: JSON.stringify(body) }),

  updateIngredient: (id: number, body: { name: string; unit: Unit; costPerUnit?: number }) =>
    request(`/stock/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteIngredient: (id: number) =>
    request(`/stock/ingredients/${id}`, { method: 'DELETE' }),

  restock: (body: { ingredientId: number; quantity: number; paid?: number; note?: string }) =>
    request<{ ok: boolean; id: number }>('/stock/restock', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getStockSummary: (params?: { start?: string; end?: string }) => {
    const q = new URLSearchParams();
    if (params?.start) q.append('start', params.start);
    if (params?.end) q.append('end', params.end);
    return request<{
      items: number;
      outOfStock: number;
      changesToday: number;
      stockWorth: number;
      spentTotal: number;
    }>(`/stock/summary${q.toString() ? `?${q.toString()}` : ''}`);
  },

  getStockEntries: (params?: { ingredientId?: number; type?: string; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams();
    if (params?.ingredientId) q.append('ingredientId', String(params.ingredientId));
    if (params?.type) q.append('type', params.type);
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    return request<{ entries: StockEntry[]; total: number }>(
      `/stock/entries${q.toString() ? `?${q.toString()}` : ''}`
    );
  },

  logUsage: (body: { ingredientId: number; quantity: number; type: 'usage' | 'wastage'; note?: string }) =>
    request<{ ok: boolean; id: number }>('/stock/usage', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getFirstRun: () => request<{ firstRun: boolean }>('/setup/first-run', {}, false),

  completeFirstRun: (store: string, pin: string) =>
    request<{ ok: boolean }>(
      '/setup/first-run',
      { method: 'POST', body: JSON.stringify({ store, pin }) },
      false
    ),

  checkUsers: () => request<{ ready: boolean }>('/users/check', {}, false),

  getUser: (id: number) => request<User>(`/users/user/${id}`),

  logout: (id: number) => request(`/users/logout/${id}`),

  getUsers: () => request<User[]>('/users/all'),

  saveUser: (body: Record<string, unknown>) =>
    request('/users/post', { method: 'POST', body: JSON.stringify(body) }),

  deleteUser: (id: number) =>
    request(`/users/user/${id}`, { method: 'DELETE' }),

  getProducts: () => request<Product[]>('/inventory/products'),

  getBestSellers: (params?: { till?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.till) qs.set('till', String(params.till));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<BestSeller[]>(`/reports/best-sellers${q ? `?${q}` : ''}`);
  },

  saveProduct: (form: FormData) =>
    request('/inventory/product', { method: 'POST', body: form }),

  deleteProduct: (id: number) =>
    request(`/inventory/product/${id}`, { method: 'DELETE' }),

  deleteProducts: (ids: number[]) =>
    request<{ ok: boolean; deleted: number }>('/inventory/products/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  findBySku: (skuCode: string) =>
    request<Product | null>('/inventory/product/sku', {
      method: 'POST',
      body: JSON.stringify({ skuCode }),
    }),

  getCategories: () => request<Category[]>('/categories/all'),

  saveCategory: (body: { name: string; icon: string; color?: string }) =>
    request('/categories/category', { method: 'POST', body: JSON.stringify(body) }),

  updateCategory: (body: { id: number; name: string; icon: string; color?: string }) =>
    request('/categories/category', { method: 'PUT', body: JSON.stringify(body) }),

  deleteCategory: (id: number) =>
    request(`/categories/category/${id}`, { method: 'DELETE' }),

  getCustomers: () => request<Customer[]>('/customers/all'),

  saveCustomer: (body: Partial<Customer>) =>
    request('/customers/customer', { method: 'POST', body: JSON.stringify(body) }),

  updateCustomer: (body: Partial<Customer>) =>
    request('/customers/customer', { method: 'PUT', body: JSON.stringify(body) }),

  deleteCustomer: (id: number) =>
    request(`/customers/customer/${id}`, { method: 'DELETE' }),

  getSettings: () => request<{ _id: number; settings: Settings }>('/settings/get'),

  saveSettings: (form: FormData) =>
    request<{ _id: number; settings: Settings }>('/settings/post', {
      method: 'POST',
      body: form,
    }),

  getOnHold: () => request<Transaction[]>('/on-hold'),

  getAllTransactions: () => request<Transaction[]>('/all'),

  getCustomerOrders: () => request<Transaction[]>('/customer-orders'),

  getByDate: (params: {
    start: string;
    end: string;
    user: number;
    till: number;
    status: number;
  }) => {
    const q = new URLSearchParams({
      start: params.start,
      end: params.end,
      user: String(params.user),
      till: String(params.till),
      status: String(params.status),
    });
    return request<Transaction[]>(`/by-date?${q}`);
  },

  createTransaction: (body: Record<string, unknown>) =>
    request<{ ok: boolean; id: number; ref_number: string }>('/new', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateTransaction: (body: Record<string, unknown>) =>
    request<{ ok: boolean; id: number; ref_number: string }>(
      `/new/${body._id ?? body.id}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    ),

  deleteTransaction: (orderId: number) =>
    request('/delete', { method: 'POST', body: JSON.stringify({ orderId }) }),

  getMediaLibrary: () => request<MediaItem[]>('/media/library'),

  uploadMedia: (file: File, alt = '') => {
    const fd = new FormData();
    fd.append('image', file);
    if (alt) fd.append('alt', alt);
    return request<MediaItem>('/media/upload', { method: 'POST', body: fd });
  },

  deleteMedia: (id: number) =>
    request(`/media/library/${id}`, { method: 'DELETE' }),



    getPrinterSettings: () =>
      request<{ printer: PrinterSettings }>('/printer/settings'),

    savePrinterSettings: (body: Partial<PrinterSettings>) =>
      request<{ printer: PrinterSettings }>('/printer/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    testPrinter: () =>
      request<{ ok: boolean; message: string; content: string }>('/printer/test', {
        method: 'POST',
      }),

    getReportSummary: (params: { start?: string; end?: string; till?: number }) => {
      const q = new URLSearchParams();
      if (params.start) q.append('start', params.start);
      if (params.end) q.append('end', params.end);
      if (params.till) q.append('till', String(params.till));
      return request<ReportSummary>(`/reports/summary?${q}`);
    },

    getDrawerSessions: (params?: { status?: string; till?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.append('status', params.status);
      if (params?.till) q.append('till', String(params.till));
      return request<DrawerSession[]>(
        `/drawer?${q}`
      );
    },

    getDrawerSummary: (till?: number) => {
      const q = new URLSearchParams();
      if (till) q.append('till', String(till));
      return request<{
        till: number;
        openSession: DrawerSession | null;
        closedSessions: DrawerSession[];
        live: { cashSales: number; expectedCash: number } | null;
        summary: {
          totalSessions: number;
          totalFloat: number;
          totalClose: number;
          totalVariance: number;
        };
      }>(`/drawer/summary${q.toString() ? `?${q.toString()}` : ''}`);
    },

    openDrawerSession: (body: { floatAmount: number; till: number }) =>
      request<DrawerSession>(
        `/drawer/open`,
        { method: 'POST', body: JSON.stringify(body) }
      ),

    closeDrawerSession: (sessionId: number, body: { countedCash: number }) =>
      request<DrawerSession>(
        `/drawer/${sessionId}/close`,
        { method: 'POST', body: JSON.stringify(body) }
      ),

    getAuditLog: (params?: {
      userId?: number;
      entityType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.userId) q.append('userId', String(params.userId));
      if (params?.entityType) q.append('entityType', params.entityType);
      if (params?.startDate) q.append('startDate', params.startDate);
      if (params?.endDate) q.append('endDate', params.endDate);
      if (params?.limit) q.append('limit', String(params.limit));
      if (params?.offset) q.append('offset', String(params.offset));
      return request<AuditLogResponse>(`/audit-log?${q}`);
    },

    request: <T = any>(path: string, options?: RequestInit, auth = true) =>
      request<T>(path, options, auth),
  };
