const TOKEN_KEY = 'pos_token';
const USER_KEY = 'pos_user';

export type User = {
  _id: number;
  id: number;
  username: string;
  fullname: string;
  has_pin?: boolean;
  perm_products: number;
  perm_categories: number;
  perm_transactions: number;
  perm_users: number;
  perm_settings: number;
  status?: string;
};

export type Product = {
  _id: number;
  id: number;
  name: string;
  price: number;
  cost: number;
  category: string;
  quantity: number;
  stock: number;
  trackStock: boolean;
  lowStockThreshold: number;
  img: string;
  hot: boolean;
  components?: ProductComponent[];
  sizes?: ProductSize[];
  modifiers?: ModifierGroup[];
};

export type ProductSize = {
  id?: number;
  name: string;
  price: number;
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

export type StockMovement = {
  id: number;
  productId: number;
  type: 'sale' | 'restock' | 'wastage' | 'adjustment';
  quantityChange: number;
  quantityAfter: number;
  reason?: string;
  referenceId?: number;
  referenceType?: string;
  userId: number;
  userName: string;
  createdAt: string;
  productName?: string;
};

export type StockMovementsResponse = {
  movements: StockMovement[];
  total: number;
};

export type Category = {
  _id: number;
  id: number;
  name: string;
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
  stock: number;
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
    return JSON.parse(raw);
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

  loginByPin: (pin: string) =>
    request<{ user: User; token: string }>(
      '/users/login-pin',
      { method: 'POST', body: JSON.stringify({ pin }) },
      false
    ),

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

  saveCategory: (body: { name: string }) =>
    request('/categories/category', { method: 'POST', body: JSON.stringify(body) }),

  updateCategory: (body: { id: number; name: string }) =>
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
    request<{ ok: boolean; id: number; ref_number: string }>('/new', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

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

  seedDemo: () =>
    request<{
      ok: boolean;
      message: string;
      categoriesAdded: number;
      productsAdded: number;
      customersAdded: number;
    }>('/demo/seed', { method: 'POST', body: '{}' }),

clearDemo: (options?: {
      products?: boolean;
      categories?: boolean;
      customers?: boolean;
      transactions?: boolean;
    }) =>
      request<{ ok: boolean; message: string; deleted: Record<string, number> }>(
        '/demo/clear',
        { method: 'POST', body: JSON.stringify(options || {}) }
      ),

    adjustStock: (productId: number, body: {
      type: 'restock' | 'wastage' | 'adjustment';
      quantityChange: number;
      reason?: string;
      userId?: number;
      userName?: string;
    }) => request<Product>(`/inventory/product/${productId}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

    getStockMovements: (params?: {
      productId?: number;
      type?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.productId) q.append('productId', String(params.productId));
      if (params?.type) q.append('type', params.type);
      if (params?.startDate) q.append('startDate', params.startDate);
      if (params?.endDate) q.append('endDate', params.endDate);
      if (params?.limit) q.append('limit', String(params.limit));
      if (params?.offset) q.append('offset', String(params.offset));
      return request<StockMovementsResponse>(`/inventory/stock-movements?${q}`);
    },

    getProductStockMovements: (productId: number, limit = 100, offset = 0) =>
      request<StockMovementsResponse>(
        `/inventory/product/${productId}/stock-movements?limit=${limit}&offset=${offset}`
      ),

    // Shifts
    getOpenShift: (till?: number) =>
      request<Shift | null>(`/shifts/open${till ? `?till=${till}` : ''}`),

    getShifts: (params?: {
      status?: string;
      till?: number;
      userId?: number;
      limit?: number;
      offset?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.status) q.append('status', params.status);
      if (params?.till) q.append('till', String(params.till));
      if (params?.userId) q.append('userId', String(params.userId));
      if (params?.limit) q.append('limit', String(params.limit));
      if (params?.offset) q.append('offset', String(params.offset));
      return request<Shift[]>(`/shifts?${q}`);
    },

    openShift: (body: { floatAmount: number; till: number }) =>
      request<Shift>('/shifts/open', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    closeShift: (shiftId: number, body: { countedCash: number }) =>
      request<Shift>(`/shifts/${shiftId}/close`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    getXReport: (shiftId: number) =>
      request<XReport>(`/shifts/${shiftId}/x-report`),

    getZReport: (shiftId: number) =>
      request<ZReport>(`/shifts/${shiftId}/z-report`),

    getReportSummary: (params: { start?: string; end?: string; till?: number }) => {
      const q = new URLSearchParams();
      if (params.start) q.append('start', params.start);
      if (params.end) q.append('end', params.end);
      if (params.till) q.append('till', String(params.till));
      return request<ReportSummary>(`/reports/summary?${q}`);
    },

    getPrinterSettings: () =>
      request<{ printer: PrinterSettings }>('/printer/settings'),

    savePrinterSettings: (body: Partial<PrinterSettings>) =>
      request<{ printer: PrinterSettings }>('/printer/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  };
