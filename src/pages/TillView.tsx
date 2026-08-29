import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Beef,
  Bike,
  Check,
  ChefHat,
  ChevronDown,
  Clock,
  Cookie,
  CreditCard,
  CupSoda,
  Minus,
  Pizza,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Smartphone,
  Soup,
  Tag,
  Trash2,
  Timer,
  Utensils,
  XIcon,
  icons,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  api,
  CartItem,
  Category,
  Customer,
  Product,
  SelectedVariant,
  SelectedModifier,
  Settings,
  Shift,
  DrawerSession,
  Transaction,
  getUploadsBase,
  PrinterSettings,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import Invoice from '../components/Invoice';
import PaymentPad from '../components/PaymentPad';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { printReceipt, printKot } from '../lib/printing';
import { highlight } from '../lib/highlight';
import { Badge } from '../components/ui/badge';
import { Avatar } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '../components/ui/card';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from '../components/ui/sheet';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui/tabs';
import { toast } from 'sonner';

const iconLibrary = icons as Record<string, LucideIcon>;

// Whole-tile fill colors for the category cards in the till menu.
const CATEGORY_TILE_BG: Record<string, string> = {
  Pizzas: 'bg-purple-200 text-purple-950',
  Burgers: 'bg-green-200 text-green-950',
  Chinese: 'bg-pink-200 text-pink-950',
  Soup: 'bg-teal-200 text-teal-950',
  Snacks: 'bg-amber-200 text-amber-950',
  Drinks: 'bg-blue-200 text-blue-950',
  Deals: 'bg-indigo-200 text-indigo-950',
};

const TILE_BG_DEFAULT = 'bg-zinc-200 text-zinc-900';
const TILE_BG_SEARCH = 'bg-amber-200 text-amber-950';

const STICKY_NOTE_ICON_STYLES = [
  'bg-amber-200 text-amber-950',
  'bg-red-200 text-red-950',
  'bg-yellow-200 text-yellow-950',
  'bg-green-200 text-green-950',
  'bg-sky-200 text-sky-950',
  'bg-purple-200 text-purple-950',
];

const CATEGORY_ACCENT: Record<string, string> = {
  Pizzas: 'border-l-purple-400',
  Burgers: 'border-l-green-400',
  Chinese: 'border-l-pink-400',
  Soup: 'border-l-teal-400',
  Snacks: 'border-l-amber-400',
  Drinks: 'border-l-blue-400',
  Deals: 'border-l-indigo-400',
};

const CART_ACCENT_DEFAULT = 'border-l-foreground/30';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

type Props = {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  settings: Settings | null;
  onRefresh: () => Promise<void>;
  holdCount: number;
  onHoldCount: (n: number) => void;
  loading?: boolean;
};

type PaymentLine = {
  method: 'cash' | 'card' | 'mobile';
  amount: number;
  tendered?: number;
};

export default function TillView({
  products,
  categories,
  customers,
  settings,
  onRefresh,
  holdCount,
  onHoldCount,
  loading = false,
}: Props) {
  const { user, apiInfo } = useAuth();
  const { t, locale } = useLocale();
  const scanRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [customerId, setCustomerId] = useState('0');
  const [oneTime, setOneTime] = useState<{ name: string; phone: string; address: string } | null>(null);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [drawerQuery, setDrawerQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'new' | 'one-time'>('search');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [draftOneTime, setDraftOneTime] = useState({ name: '', phone: '', address: '' });
  const [discount, setDiscount] = useState(0);
  const [fulfillment, setFulfillment] = useState<'takeaway' | 'dine-in' | 'delivery'>('takeaway');
  const [fulfillmentChosen, setFulfillmentChosen] = useState(false);
  const [fulfillmentPickerOpen, setFulfillmentPickerOpen] = useState(false);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryContact, setDeliveryContact] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showVoid, setShowVoid] = useState(false);
  const [popupProduct, setPopupProduct] = useState<Product | null>(null);
  const [selSize, setSelSize] = useState<number>(-1);
  const [selModifiers, setSelModifiers] = useState<boolean[][]>([]);
  const [activeHoldId, setActiveHoldId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHolds, setShowHolds] = useState(false);
  const [holds, setHolds] = useState<Transaction[]>([]);

  // Printer State
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings | null>(null);
  const [printerLoading, setPrinterLoading] = useState(true);

  // Cash drawer state for the till banner
  const [drawerSession, setDrawerSession] = useState<DrawerSession | null>(null);
  const [closeDrawerOpen, setCloseDrawerOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [drawerWarningDismissed, setDrawerWarningDismissed] = useState(false);
  const [openDrawerDialog, setOpenDrawerDialog] = useState(false);
  const [floatAmount, setFloatAmount] = useState('');

  const loadPrinterSettings = async () => {
    try {
      const res = await api.getPrinterSettings();
      setPrinterSettings(res.printer);
    } catch {
      setPrinterSettings(null);
    } finally {
      setPrinterLoading(false);
    }
  };

  // Payment State
  const [showPay, setShowPay] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [amountInput, setAmountInput] = useState('');
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);

  const [invoice, setInvoice] = useState<Transaction | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const symbol = settings?.symbol || 'Rs';
  const taxRate = settings?.charge_tax ? Number(settings.percentage) || 0 : 0;
  const uploads = getUploadsBase();

  const refreshHolds = async () => {
    try {
      const list = await api.getOnHold();
      setHolds(list);
      onHoldCount(list.length);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refreshHolds();
    scanRef.current?.focus();
  }, []);

  useEffect(() => {
    loadPrinterSettings();
  }, []);

  const till = settings?.till || 1;

  const loadDrawerSession = useCallback(async () => {
    try {
      const sessions = await api.getDrawerSessions({ status: 'open', till });
      const open = sessions[0] ?? null;
      setDrawerSession(open);
    } catch {
      /* ignore */
    }
  }, [till]);

  useEffect(() => {
    void loadDrawerSession();
    const id = setInterval(() => void loadDrawerSession(), 60_000);
    return () => clearInterval(id);
  }, [loadDrawerSession]);

  const confirmCloseDrawer = async () => {
    if (!drawerSession) return;
    const cash = parseFloat(countedCash);
    if (isNaN(cash) || cash < 0) {
      toast.error(t('till.countError'));
      return;
    }
    try {
      await api.closeDrawerSession(drawerSession.id, { countedCash: cash });
      setDrawerSession(null);
      setCloseDrawerOpen(false);
      setCountedCash('');
      setDrawerWarningDismissed(false);
      toast.success(t('till.drawerClosedForDay'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('till.couldNotCloseDrawer'));
    }
  };

  const handleOpenDrawer = async () => {
    const float = parseFloat(floatAmount) || 0;
    if (float < 0) return;
    try {
      await api.openDrawerSession({ floatAmount: float, till });
      setOpenDrawerDialog(false);
      setFloatAmount('');
      await loadDrawerSession();
      toast.success(t('till.drawerOpenedForDay'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('till.couldNotOpenDrawer'));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length) openPay();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        openHolds();
      }
      if (e.key === 'Escape' && showPay) {
        setShowPay(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, showPay]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const catOk =
        categoryFilter === 'all' || categoryFilter === 'search' || p.category === categoryFilter;
      if (!q) return catOk;
      return catOk && (p.name.toLowerCase().includes(q) || String(p.id).includes(q));
    });
  }, [products, query, categoryFilter]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const getLineTotal = (item: CartItem) => {
    const base = item.price * item.quantity;
    if (!item.discountValue || item.discountValue <= 0) return base;
    if (item.discountType === 'percent') {
      return Math.max(0, base * (1 - item.discountValue / 100));
    }
    return Math.max(0, base - item.discountValue);
  };

  const lineSubtotal = cart.reduce((sum, item) => sum + getLineTotal(item), 0);
  const afterOrderDiscount = Math.max(0, lineSubtotal - (Number(discount) || 0));
  const tax = afterOrderDiscount * (taxRate / 100);
  const total = afterOrderDiscount + tax;
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Payment Calculations
  const totalPaid = paymentLines.reduce((sum, line) => sum + line.amount, 0);
  const remainingDue = Math.max(0, total - totalPaid);
  const totalChange = paymentLines.reduce((sum, line) => {
    if (line.method === 'cash' && line.tendered && line.tendered > line.amount) {
      return sum + (line.tendered - line.amount);
    }
    return sum;
  }, 0);

  const addToCart = (product: Product) => {
    if ((product.sizes && product.sizes.length) || (product.modifiers && product.modifiers.length)) {
      openVariantPopup(product);
      return;
    }
    setError(null);
    addInstant(product);
  };

  const openVariantPopup = (product: Product) => {
    setPopupProduct(product);
    setSelSize(-1);
    setSelModifiers((product.modifiers || []).map((g) => g.options.map(() => false)));
  };

  const addInstant = (product: Product) => {
    setError(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          components: product.components,
          categoryName: product.category,
        },
      ];
    });
  };

  const popupUnitPrice = () => {
    const product = popupProduct;
    if (!product) return 0;
    const sizePrice = product.sizes?.length ? (selSize >= 0 ? product.sizes[selSize].price : 0) : Number(product.price);
    const modDelta = (product.modifiers || []).reduce(
      (sum, g, gi) => sum + g.options.reduce((s, o, oi) => s + (selModifiers[gi]?.[oi] ? o.priceDelta : 0), 0),
      0
    );
    return sizePrice + modDelta;
  };

  const confirmVariantPopup = () => {
    const product = popupProduct;
    if (!product) return;
    const sizes = product.sizes || [];
    if (sizes.length && selSize < 0) {
      setError(t('till.pleaseChooseSize'));
      return;
    }
    const selectedVariants: SelectedVariant[] = sizes.length
      ? [{ group: 'Size', name: sizes[selSize].name, priceDelta: sizes[selSize].price - Number(product.price) }]
      : [];
    const modifiers = product.modifiers || [];
    const selectedModifiers: SelectedModifier[] = [];
    modifiers.forEach((g, gi) => {
      g.options.forEach((o, oi) => {
        if (selModifiers[gi]?.[oi]) selectedModifiers.push({ name: o.name, priceDelta: o.priceDelta });
      });
    });
    const unitPrice = popupUnitPrice();
    setError(null);
    setCart((prev) => [
      ...prev,
      {
        id: product.id,
        name: product.name,
        price: unitPrice,
        basePrice: Number(product.price),
        quantity: 1,
        components: product.components,
        selectedVariants,
        selectedModifiers,
        categoryName: product.category,
      },
    ]);
    setPopupProduct(null);
    scanRef.current?.focus();
  };

  const setQty = (id: number, quantity: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeLine = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setActiveHoldId(null);
    setCustomerId('0');
    setOneTime(null);
    setFulfillment('takeaway');
    setFulfillmentChosen(false);
    setDeliveryName('');
    setDeliveryContact('');
    setDeliveryAddress('');
    setError(null);
    scanRef.current?.focus();
  };

  const chooseFulfillment = (next: 'takeaway' | 'dine-in' | 'delivery') => {
    setFulfillment(next);
    setFulfillmentChosen(true);
    setFulfillmentPickerOpen(false);
    if (next === 'delivery' && customerId === '0' && !oneTime) {
      setCustomerDrawerOpen(true);
    }
  };

  const onScan = async () => {
    const code = query.trim();
    if (!code) return;
    try {
      const product = await api.findBySku(code);
      if (product) {
        addToCart(product);
        setQuery('');
        scanRef.current?.focus();
        return;
      }
      const local =
        products.find((p) => String(p.id) === code) ||
        products.find((p) => p.name.toLowerCase() === code.toLowerCase());
      if (local) {
        addToCart(local);
        setQuery('');
        scanRef.current?.focus();
      } else {
        setError(t('till.noProductForCode', { code }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.scanFailed'));
    }
  };

  const openPay = () => {
    if (fulfillment === 'delivery' && !deliveryReady) {
      setError(
        t('till.deliveryNeedsDetails')
      );
      setCustomerDrawerOpen(true);
      return;
    }
    setError(null);
    setPaymentLines([]);
    setSelectedMethod('cash');
    setAmountInput('');
    setShowPay(true);
  };

  const selectedCustomer = customers.find((c) => String(c.id) === customerId) || null;
  const chipLabel =
    selectedCustomer?.name ||
    (oneTime && oneTime.name.trim() ? oneTime.name : t('common.walkin'));
  const deliveryReady =
    !!selectedCustomer ||
    !!(oneTime && oneTime.name.trim() && oneTime.phone.trim() && oneTime.address.trim());

  const drawerResults = (() => {
    const q = drawerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  })();

  const chooseSavedCustomer = (id: number, name: string) => {
    setCustomerId(String(id));
    setOneTime(null);
    setDeliveryName(name);
    setDeliveryContact(customers.find((c) => c.id === id)?.phone || '');
    setDeliveryAddress(customers.find((c) => c.id === id)?.address || '');
    setCustomerDrawerOpen(false);
    setDrawerQuery('');
  };

  const quickCreateCustomer = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await api.saveCustomer({ name, phone: newPhone.trim(), email: '', address: newAddress.trim() });
      await onRefresh();
      const refreshed = await api.getCustomers();
      const created = refreshed.filter((c) => c.name === name).sort((a, b) => b.id - a.id)[0];
      if (created) {
        setCustomerId(String(created.id));
        setOneTime(null);
        setDeliveryName(created.name);
        setDeliveryContact(created.phone);
        setDeliveryAddress(created.address);
      }
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setCustomerDrawerOpen(false);
      toast.success(t('till.customerSaved', { name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.couldNotSaveCustomer'));
    }
  };

  const attachOneTime = () => {
    setCustomerId('0');
    setOneTime({
      name: draftOneTime.name.trim(),
      phone: draftOneTime.phone.trim(),
      address: draftOneTime.address.trim(),
    });
    setDeliveryName(draftOneTime.name.trim());
    setDeliveryContact(draftOneTime.phone.trim());
    setDeliveryAddress(draftOneTime.address.trim());
    setDraftOneTime({ name: '', phone: '', address: '' });
    setCustomerDrawerOpen(false);
  };

  const openDrawer = () => {
    // Pre-fill the one-time form when editing existing ephemeral details
    if (!oneTime) setDraftOneTime({ name: '', phone: '', address: '' });
    setCustomerDrawerOpen(true);
  };

  const addPaymentLine = () => {
    const val = parseFloat(amountInput) || remainingDue;
    if (val <= 0) return;

    if (selectedMethod === 'cash') {
      const tendered = val;
      const amount = Math.min(tendered, remainingDue > 0 ? remainingDue : tendered);
      setPaymentLines((prev) => [
        ...prev,
        { method: 'cash', amount, tendered },
      ]);
    } else {
      const amount = Math.min(val, remainingDue > 0 ? remainingDue : val);
      setPaymentLines((prev) => [
        ...prev,
        { method: selectedMethod, amount },
      ]);
    }
    setAmountInput('');
  };

  // Refocus the amount field (with its text selected) after a payment line is
  // added or the method changes. Query the live DOM fresh (instead of the ref)
  // because the input node is recreated when the dialog re-renders, which
  // detaches the ref before the timer fires.
  useEffect(() => {
    if (!showPay) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(
        '[data-testid="pay-amount"]',
      );
      el?.focus();
      el?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [paymentLines, selectedMethod, showPay]);

  const switchPaymentMethod = (method: 'cash' | 'card' | 'mobile') => {
    setSelectedMethod(method);
  };

  const removePaymentLine = (index: number) => {
    setPaymentLines((prev) => prev.filter((_, i) => i !== index));
  };

  const buildOrderPayload = (status: number) => {
    const customer = customers.find((c) => String(c.id) === customerId);
    const finalPaid = paymentLines.reduce((sum, l) => sum + (l.tendered || l.amount), 0);
    const finalChange = totalChange;

    return {
      ref_number: status === 0 ? `H-${Date.now().toString().slice(-6)}` : '',
      customer: customerId,
      customer_name:
        customer?.name || (oneTime?.name.trim() ? oneTime.name : 'Walk-in Customer'),
      status,
      user_id: user?._id || 0,
      user: user?.fullname || '',
      till: apiInfo?.till || settings?.till || 1,
      discount: Number(discount) || 0,
      subtotal: lineSubtotal,
      tax,
      total,
      paid: finalPaid || total,
      change: finalChange,
      payment_type: selectedMethod === 'cash' ? 1 : selectedMethod === 'card' ? 2 : 3,
      payment_breakdown: paymentLines.length > 0 ? paymentLines : [{ method: selectedMethod, amount: total }],
      items: cart,
      date: new Date().toISOString(),
      fulfillment,
      delivery_name: deliveryName,
      delivery_contact: deliveryContact,
      delivery_address: deliveryAddress,
    };
  };

  const holdOrder = async () => {
    if (!cart.length) return;
    try {
      const body = buildOrderPayload(0);
      if (activeHoldId) {
        await api.updateTransaction({ ...body, _id: activeHoldId });
      } else {
        await api.createTransaction(body);
      }
      clearCart();
      await refreshHolds();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.couldNotHold'));
    }
  };

  const completeSale = async () => {
    let currentLines = [...paymentLines];
    if (currentLines.length === 0) {
      const val = parseFloat(amountInput) || total;
      if (selectedMethod === 'cash') {
        const tendered = val;
        const amount = Math.min(tendered, total);
        currentLines = [{ method: 'cash', amount, tendered }];
      } else {
        currentLines = [{ method: selectedMethod, amount: total }];
      }
    }

    const linesTotal = currentLines.reduce((sum, l) => sum + l.amount, 0);
    if (linesTotal + 0.0001 < total) {
      setError(t('till.paymentNotCovering'));
      return;
    }

    const customer = customers.find((c) => String(c.id) === customerId);
    const finalPaid = currentLines.reduce((sum, l) => sum + (l.tendered || l.amount), 0);
    const finalChange = currentLines.reduce((sum, line) => {
      if (line.method === 'cash' && line.tendered && line.tendered > line.amount) {
        return sum + (line.tendered - line.amount);
      }
      return sum;
    }, 0);

    const body = {
      ref_number: '',
      customer: customerId,
      customer_name:
        customer?.name || (oneTime?.name.trim() ? oneTime.name : 'Walk-in Customer'),
      status: 1,
      user_id: user?._id || 0,
      user: user?.fullname || '',
      till: apiInfo?.till || settings?.till || 1,
      discount: Number(discount) || 0,
      subtotal: lineSubtotal,
      tax,
      total,
      paid: finalPaid,
      change: finalChange,
      payment_type: currentLines[0]?.method === 'card' ? 2 : currentLines[0]?.method === 'mobile' ? 3 : 1,
      payment_breakdown: currentLines,
      items: cart,
      date: new Date().toISOString(),
      fulfillment,
      delivery_name: deliveryName,
      delivery_contact: deliveryContact,
      delivery_address: deliveryAddress,
    };

    try {
      let savedId = 0;
      let savedRef = '';
      if (activeHoldId) {
        const res = await api.updateTransaction({
          ...body,
          _id: activeHoldId,
          ref_number: '',
        });
        savedId = activeHoldId;
        savedRef = res.ref_number;
      } else {
        const res = await api.createTransaction(body);
        savedId = res.id;
        savedRef = res.ref_number;
      }
      const savedTx = {
        ...body,
        _id: savedId,
        id: savedId,
        ref_number: savedRef,
      };
      setInvoice(savedTx);
      setShowInvoice(true);
      clearCart();
      setShowPay(false);
      await onRefresh();
      await refreshHolds();

      // Auto-print KOT if configured
      if (
        printerSettings?.kotInterface &&
        printerSettings.autoPrintKot &&
        savedTx.fulfillment !== 'delivery'
      ) {
        try {
          await printKot(savedTx);
        } catch {
          /* KOT print failure falls through to manual reprint */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.saleCompletionFailed'));
    }
  };

  const openHolds = async () => {
    await refreshHolds();
    setShowHolds(true);
  };

  const restoreHold = (order: Transaction) => {
    setCart(order.items || []);
    setCustomerId(String(order.customer || '0'));
    setDiscount(order.discount || 0);
    setActiveHoldId(order.id);
    if (order.fulfillment !== 'delivery' || (order.customer && order.customer !== '0')) {
      setOneTime(null);
    } else if (order.fulfillment === 'delivery') {
      setOneTime(
        order.delivery_name || order.delivery_contact || order.delivery_address
          ? {
              name: order.delivery_name || '',
              phone: order.delivery_contact || '',
              address: order.delivery_address || '',
            }
          : null
      );
    }
    setFulfillment((order.fulfillment as 'takeaway' | 'dine-in' | 'delivery') || 'takeaway');
    setFulfillmentChosen(true);
    setDeliveryName(order.delivery_name || '');
    setDeliveryContact(order.delivery_contact || '');
    setDeliveryAddress(order.delivery_address || '');
    setShowHolds(false);
    scanRef.current?.focus();
  };

  const discardHold = async (id: number) => {
    try {
      await api.deleteTransaction(id);
      await refreshHolds();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.couldNotDiscard'));
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3 overflow-hidden bg-muted/20">
      {error && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-md bg-destructive px-4 py-3 text-destructive-foreground shadow-md">
          <AlertCircle className="size-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive-foreground hover:bg-destructive/80"
            onClick={() => setError(null)}
          >
            {t('till.dismiss')}
          </Button>
        </div>
      )}

      {!drawerSession && !drawerWarningDismissed && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="size-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">{t('till.drawerNotOpen')}</p>
            <p className="text-xs text-amber-600">{t('till.openDrawerFirst')}</p>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 text-white hover:bg-amber-700"
            onClick={() => setOpenDrawerDialog(true)}
          >
            {t('shell.openDrawer')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-600 hover:text-amber-800"
            onClick={() => setDrawerWarningDismissed(true)}
          >
            {t('till.dismiss')}
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row gap-3 overflow-hidden">

      {/* Menu surface: search + tabs + grid in one panel */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
        {!fulfillmentChosen ? (
          <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6"
            data-testid="fulfillment-gate"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold">{t('till.fulfillmentGateTitle')}</h2>
              <p className="mt-1 text-muted-foreground">{t('till.fulfillmentGateDesc')}</p>
            </div>
            <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
              <button
                type="button"
                data-testid="fulfillment-choice-dine-in"
                onClick={() => chooseFulfillment('dine-in')}
                className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Utensils className="size-8" />
                <span className="text-lg font-bold">{t('till.dineIn')}</span>
              </button>
              <button
                type="button"
                data-testid="fulfillment-choice-takeaway"
                onClick={() => chooseFulfillment('takeaway')}
                className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ShoppingBag className="size-8" />
                <span className="text-lg font-bold">{t('till.takeaway')}</span>
              </button>
              <button
                type="button"
                data-testid="fulfillment-choice-delivery"
                onClick={() => chooseFulfillment('delivery')}
                className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Bike className="size-8" />
                <span className="text-lg font-bold">{t('till.delivery')}</span>
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="flex flex-col gap-2 border-b p-3">
          <ScrollArea className="w-full">
            <div className="flex flex-wrap overflow-y-scroll gap-2 pb-1">
              <button
                type="button"
                data-testid="cat-tab-search"
                onClick={() => setCategoryFilter('search')}
                aria-pressed={categoryFilter === 'search'}
                className={`group relative flex h-32 w-40 flex-col items-start justify-between rounded-xl border-2 p-4 text-left transition-colors ${TILE_BG_SEARCH} ${
                  categoryFilter === 'search'
                    ? 'border-primary ring-2 ring-primary/25'
                    : 'border-border hover:border-foreground'
                }`}
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-white/60">
                  <Search className="size-5" />
                </span>
                <span className="text-base font-bold leading-tight">{t('till.tabSearch')}</span>
                {categoryFilter === 'search' && (
                  <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
              {categories.map((c) => {
                const Icon = iconLibrary[c.icon] || Utensils;
                const active = categoryFilter === c.name;
                const tone = CATEGORY_TILE_BG[c.name] || TILE_BG_DEFAULT;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`cat-tab-${c.name}`}
                    aria-pressed={active}
                    onClick={() => setCategoryFilter(c.name)}
                    className={`group relative flex h-32 w-40 flex-col items-start justify-between rounded-xl border-2 p-4 text-left transition-colors ${tone} ${
                      active
                        ? 'border-primary ring-2 ring-primary/25'
                        : 'border-border hover:border-foreground'
                    }`}
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-white/60">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-base font-bold leading-tight">{c.name}</span>
                    {active && (
                      <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {categoryFilter === 'search' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={scanRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onScan();
                }}
                placeholder={t('till.searchAllItems')}
                className="pl-9 h-11 text-base"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Product Grid */}
        <ScrollArea className="min-h-0 flex-1 p-0">
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex flex-col justify-between gap-3 rounded-xl border-2 border-border bg-card p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              ))
            ) : (
              filteredProducts.map((p) => {
              const hasVariants = (p.sizes?.length || 0) > 0;
              const hasModifiers = (p.modifiers?.length || 0) > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`product-${p.id}`}
                  onClick={() => addToCart(p)}
                  className="group relative flex flex-col justify-between gap-3 rounded-xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-bold leading-tight capitalize md:text-xl">{p.name}</h3>
                    {(hasVariants || hasModifiers) && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold leading-tight text-primary-foreground">
                        {t('till.options')}
                      </span>
                    )}
                  </div>
                  {p.sizes && p.sizes.length > 0 ? (
                    <span className="font-extrabold text-primary text-base tabular-nums md:text-xs">
                      {t('till.from')} {symbol}
                      {Math.min(...p.sizes.map((sz) => Number(sz.price) || 0)).toFixed(2)}
                    </span>
                  ) : (
                    <span className="font-extrabold text-primary text-lg tabular-nums md:text-xs">
                      {symbol}
                      {Number(p.price).toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })
            )}
            {!loading && !filteredProducts.length && (
              <div className="col-span-full py-16 text-center text-muted-foreground">
                {t('till.noProductsFound')}
              </div>
            )}
          </div>
        </ScrollArea>
        </>
        )}
      </div>

      {/* Right Panel: Cart Card */}
      <Card className="flex min-h-0 w-full flex-col lg:w-[480px] shrink-0 h-full shadow-sm">
        <CardHeader className="pb-3 border-b space-y-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                data-testid="customer-chip"
                onClick={openDrawer}
                className="flex h-10 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                title={t('till.chooseCustomer')}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    customerId !== '0' || oneTime
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {chipLabel.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{chipLabel}</span>
                {oneTime && <Badge variant="secondary" className="shrink-0">{t('till.oneTime')}</Badge>}
                {fulfillment === 'delivery' && !deliveryReady && (
                  <Badge variant="destructive" className="shrink-0">{t('till.detailsNeeded')}</Badge>
                )}
              </button>
            </div>
            <button
              type="button"
              data-testid="fulfillment-chip"
              onClick={() => setFulfillmentPickerOpen(true)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              title={t('till.changeFulfillment')}
            >
              {fulfillment === 'dine-in' ? (
                <Utensils className="size-4" />
              ) : fulfillment === 'delivery' ? (
                <Bike className="size-4" />
              ) : (
                <ShoppingBag className="size-4" />
              )}
              <span>
                {fulfillment === 'dine-in'
                  ? t('till.dineIn')
                  : fulfillment === 'delivery'
                    ? t('till.delivery')
                    : t('till.takeaway')}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
            {invoice && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setShowInvoice(true)}
                title={t('till.lastReceipt')}
              >
                <Receipt className="size-4" />
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              onClick={openHolds}
              className="relative h-10 shrink-0 gap-1.5 bg-blue-600 text-white shadow-[3px_3px_0_0] shadow-blue-600/40 transition-all hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <Clock className="size-4" />
              <span>{t('till.held')}</span>
              {holdCount > 0 && (
                <Badge variant="default" className="ml-1 bg-white/20 px-1.5 py-0.5 text-xs">
                  {holdCount}
                </Badge>
              )}
            </Button>
          </div>

        </CardHeader>

        {/* Cart Item List */}
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            <div className="flex flex-col gap-3">
              {cart.map((item) => {
                const lineTotal = getLineTotal(item);
                const accent = CATEGORY_ACCENT[item.categoryName || ''] || CART_ACCENT_DEFAULT;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-lg border border-l-4 bg-card p-1.5 shadow-[2px_2px_0_0] shadow-black/10 ${accent}`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-tight">{item.name}</span>
                      {(item.selectedVariants?.length || item.selectedModifiers?.length) && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {item.selectedVariants?.map((v, vi) => (
                            <span key={vi} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {v.name}
                            </span>
                          ))}
                          {item.selectedModifiers?.map((m, mi) => (
                            <span key={mi} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              + {m.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-sm font-bold tabular-nums">{symbol}{lineTotal.toFixed(2)}</span>
                      <div className="flex items-center gap-0.5 rounded-md border bg-muted/50 p-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          onClick={() => setQty(item.id, item.quantity - 1)}
                          aria-label={t('till.decreaseQty')}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          onClick={() => setQty(item.id, item.quantity + 1)}
                          aria-label={t('till.increaseQty')}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeLine(item.id)}
                        aria-label={t('till.removeItem')}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!cart.length && (
                <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <ShoppingBag className="size-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium">{t('till.cartEmpty')}</p>
                  <p className="text-xs text-muted-foreground">{t('till.cartEmptyHint')}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        {/* Totals & Action Footer */}
        <CardFooter className="flex-col gap-3 border-t p-4 bg-muted/10">
          <div className="w-full space-y-2 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t('till.orderDiscount', { symbol })}</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discount || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val < 0) {
                    setError(t('till.discountNegative'));
                  } else {
                    if (error === t('till.discountNegative')) setError(null);
                    setDiscount(val);
                  }
                }}
                className={`w-24 h-8 text-right text-xs ${discount < 0 ? 'border-destructive' : ''}`}
                placeholder="0.00"
                data-testid="order-discount"
              />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t('till.subtotal', { count: itemCount, items: itemCount === 1 ? t('till.itemOne') : t('till.itemsMany') })}</span>
              <span data-testid="cart-subtotal">
                {symbol}
                {lineSubtotal.toFixed(2)}
              </span>
            </div>
            {!!taxRate && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{t('till.taxRow', { rate: taxRate })}</span>
                <span>
                  {symbol}
                  {tax.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-lg font-bold pt-2 border-t text-foreground">
              <span>{t('common.total')}</span>
              <span className="text-primary text-xl" data-testid="cart-total">
                {symbol}
                {total.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full pt-1">
            <Button
              variant="outline"
              onClick={clearCart}
              disabled={!cart.length}
              className="h-12"
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              onClick={holdOrder}
              disabled={!cart.length}
              className="h-12"
            >
              Hold
            </Button>
            <Button
              onClick={openPay}
              disabled={!cart.length || discount < 0}
              className="h-12 text-base font-semibold"
            >
              {t('till.pay')}
            </Button>
          </div>
        </CardFooter>
      </Card>
      </div>

      {/* Close Drawer Dialog */}
      <Dialog open={closeDrawerOpen} onOpenChange={setCloseDrawerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('drawer.endDay')}</DialogTitle>
            <DialogDescription>
              {t('drawer.endDayDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="till-counted-cash">{t('drawer.counted', { symbol })}</Label>
            <Input
              id="till-counted-cash"
              type="number"
              step="0.01"
              min={0}
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDrawerOpen(false)}>
              {t('drawer.notNow')}
            </Button>
            <Button onClick={confirmCloseDrawer} disabled={!countedCash.trim()}>
              {t('shell.closeDrawer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Drawer Dialog */}
      <Dialog open={openDrawerDialog} onOpenChange={setOpenDrawerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('drawer.openTitle')}</DialogTitle>
            <DialogDescription>
              {t('drawer.openDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="till-float-amount">{t('drawer.start', { symbol })}</Label>
              <Input
                id="till-float-amount"
                type="number"
                step="0.01"
                min={0}
                value={floatAmount}
                onChange={(e) => setFloatAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('drawer.openHelper')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDrawerDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleOpenDrawer} disabled={!floatAmount.trim()}>
              {t('shell.openDrawer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held Orders Dialog */}
      <Dialog open={showHolds} onOpenChange={setShowHolds}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('till.heldOrders')}</DialogTitle>
            <DialogDescription>
              Select a parked order to resume or discard it.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[380px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('till.ref')}</TableHead>
                  <TableHead>{t('till.customer')}</TableHead>
                  <TableHead>{t('common.items')}</TableHead>
                  <TableHead>{t('common.total')}</TableHead>
                  <TableHead>{t('till.time')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holds.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-xs">{h.ref_number || h.id}</TableCell>
                    <TableCell>{h.customer_name}</TableCell>
                    <TableCell>{(h.items || []).reduce((n, i) => n + i.quantity, 0)}</TableCell>
                    <TableCell className="font-semibold">
                      <span className={highlight.green}>{symbol}{Number(h.total).toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" onClick={() => restoreHold(h)}>
                        {t('till.resume')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => discardHold(h.id)}>
                        {t('till.discard')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!holds.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('till.noHeldOrders')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHolds(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Order Confirmation Dialog */}
      <Dialog open={showVoid} onOpenChange={setShowVoid}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('till.voidTitle')}</DialogTitle>
            <DialogDescription>
              {t('till.voidDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowVoid(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearCart();
                setShowVoid(false);
              }}
            >
              {t('till.voidOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant / Modifier Selection Dialog */}
      <Dialog
        open={!!popupProduct}
        onOpenChange={(o) => {
          if (!o) {
            setPopupProduct(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{popupProduct?.name}</DialogTitle>
            <DialogDescription>
              {symbol}
              {popupProduct ? Number(popupProduct.price).toFixed(2) : '0.00'} {t('till.base')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-auto pr-1">
            {(popupProduct?.sizes || []).length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {t('till.size')} <span className="text-xs font-normal text-muted-foreground">{t('till.chooseOne')}</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(popupProduct?.sizes || []).map((s, si) => (
                    <button
                      key={si}
                      type="button"
                      onClick={() => setSelSize(si)}
                      className={`flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors ${
                        selSize === si ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {symbol}
                        {Number(s.price).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(popupProduct?.modifiers || []).map((group, gi) => (
              <div key={gi} className="space-y-2">
                <Label className="text-sm font-semibold">
                  {group.name} <span className="text-xs font-normal text-muted-foreground">{t('till.optional')}</span>
                </Label>
                <div className="grid gap-1">
                  {group.options.map((opt, oi) => (
                    <button
                      key={oi}
                      type="button"
                      onClick={() =>
                        setSelModifiers((prev) =>
                          prev.map((row, r) =>
                            r === gi ? row.map((c, c2) => (c2 === oi ? !c : c)) : row
                          )
                        )
                      }
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                        selModifiers[gi]?.[oi]
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span>{opt.name}</span>
                      <span className="text-muted-foreground">
                        {opt.priceDelta ? `+${symbol}${opt.priceDelta.toFixed(2)}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setPopupProduct(null); setError(null); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={confirmVariantPopup} className="px-8 font-semibold">
              {t('till.addToOrder', { price: `${symbol}${popupUnitPrice().toFixed(2)}` })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-method Split Checkout Dialog */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent className="sm:max-w-7xl">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive px-4 py-3 text-destructive-foreground shadow-sm" data-testid="checkout-error">
              <AlertCircle className="size-5 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          <DialogHeader>
            <DialogTitle>{t('till.checkout')}</DialogTitle>
            <DialogDescription>
              {t('till.totalToPay')} <span className="font-bold text-foreground">{symbol}{total.toFixed(2)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Payment Method Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={selectedMethod === 'cash' ? 'default' : 'outline'}
                onClick={() => switchPaymentMethod('cash')}
                className="flex flex-col gap-1 h-14"
              >
                <Banknote className="size-5" />
                <span className="text-xs">{t('till.method.cash')}</span>
              </Button>
              <Button
                type="button"
                variant={selectedMethod === 'card' ? 'default' : 'outline'}
                onClick={() => switchPaymentMethod('card')}
                className="flex flex-col gap-1 h-14"
              >
                <CreditCard className="size-5" />
                <span className="text-xs">{t('till.method.card')}</span>
              </Button>
              <Button
                type="button"
                variant={selectedMethod === 'mobile' ? 'default' : 'outline'}
                onClick={() => switchPaymentMethod('mobile')}
                className="flex flex-col gap-1 h-14"
              >
                <Smartphone className="size-5" />
                <span className="text-xs">{t('till.method.mobile')}</span>
              </Button>
            </div>

            <div className={`grid gap-4 ${selectedMethod === 'cash' ? 'md:grid-cols-2' : ''}`}>
              {/* Left: amount, payment lines, summary */}
              <div className="space-y-4">
                {/* Input & Add Line */}
                <div className="grid gap-2">
                  <Label>{t('till.amountPaid', { symbol })}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value.replace(/[^\d.]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addPaymentLine();
                        }
                      }}
                      placeholder={t('till.amountOwed', { amount: `${symbol}${remainingDue.toFixed(2)}` })}
                      className="h-12 font-mono text-xl font-bold text-right"
                      autoFocus
                      data-testid="pay-amount"
                    />
                    <Button
                      type="button"
                      onClick={addPaymentLine}
                      className="h-12 px-4"
                    >
                      {t('till.add')}
                    </Button>
                  </div>
                </div>

                {selectedMethod === 'cash' && (
                  <ErrorBoundary fallbackTitle={t('till.keypadFallback')}>
                    <PaymentPad
                      value={amountInput}
                      onChange={setAmountInput}
                      due={remainingDue}
                      symbol={symbol}
                      showNumpad={false}
                    />
                  </ErrorBoundary>
                )}

                {/* Added Payment Lines */}
                {paymentLines.length > 0 && (
                  <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                    <Label className="text-xs font-semibold text-muted-foreground">{t('till.paymentsAdded')}</Label>
                    {paymentLines.map((line, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1 border-b last:border-b-0">
                        <span className="capitalize font-medium">{line.method}</span>
                        <div className="flex items-center gap-2">
                          <span>
                            {symbol}{line.amount.toFixed(2)}
                            {line.tendered && line.tendered > line.amount ? ` ${t('till.tendered', { amount: `${symbol}${line.tendered.toFixed(2)}` })}` : ''}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removePaymentLine(idx)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary */}
                <div className="flex flex-col gap-1 rounded-lg border p-3 bg-muted/40 text-sm">
                  <div className="flex justify-between">
                    <span>{t('till.stillOwed')}</span>
                    <span className={`font-bold ${remainingDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {symbol}{remainingDue.toFixed(2)}
                    </span>
                  </div>
                  {totalChange > 0 && (
                    <div className="mt-1 flex items-center justify-between rounded-md bg-accent px-3 py-2">
                      <span className="font-bold">{t('till.changeBack')}</span>
                      <span className="text-2xl font-extrabold tabular-nums text-primary" data-testid="change-amount">
                        {symbol}{totalChange.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: number pad */}
              {selectedMethod === 'cash' && (
                <div>
                  <ErrorBoundary fallbackTitle={t('till.keypadFallback')}>
                    <PaymentPad
                      value={amountInput}
                      onChange={setAmountInput}
                      due={remainingDue}
                      symbol={symbol}
                      showQuickCash={false}
                    />
                  </ErrorBoundary>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowPay(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={completeSale}
              disabled={paymentLines.length === 0 && remainingDue > 0 && !(parseFloat(amountInput) >= total)}
              className="flex-1 font-semibold"
              data-testid="pay-now"
            >
              {t('till.payNow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable Receipt / Invoice Dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('till.saleComplete')}</DialogTitle>
          </DialogHeader>
          <div id="printable-receipt" className="border p-4 rounded-md bg-white text-black">
            {invoice && (
              <ErrorBoundary fallbackTitle={t('till.receiptFailed')}>
                <Invoice tx={invoice} settings={settings} symbol={symbol} />
              </ErrorBoundary>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowInvoice(false)}>
              {t('common.close')}
            </Button>
            {printerSettings?.kotInterface && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => invoice && void printKot(invoice)}
              >
                <Printer className="size-3.5 mr-1.5" />
                {t('till.reprintKot')}
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={() => (invoice ? void printReceipt(invoice, settings, false) : window.print())}
            >
              <Printer className="size-4" />
              {t('till.print')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfillment re-picker dialog */}
      <Dialog open={fulfillmentPickerOpen} onOpenChange={setFulfillmentPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('till.fulfillmentPickerTitle')}</DialogTitle>
            <DialogDescription>
              {t('till.fulfillmentGateDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              data-testid="fulfillment-repick-dine-in"
              onClick={() => chooseFulfillment('dine-in')}
              className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <Utensils className="size-7" />
              <span className="font-bold">{t('till.dineIn')}</span>
            </button>
            <button
              type="button"
              data-testid="fulfillment-repick-takeaway"
              onClick={() => chooseFulfillment('takeaway')}
              className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <ShoppingBag className="size-7" />
              <span className="font-bold">{t('till.takeaway')}</span>
            </button>
            <button
              type="button"
              data-testid="fulfillment-repick-delivery"
              onClick={() => chooseFulfillment('delivery')}
              className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <Bike className="size-7" />
              <span className="font-bold">{t('till.delivery')}</span>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFulfillmentPickerOpen(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

<Sheet open={customerDrawerOpen} onOpenChange={(o) => { if (!o) setCustomerDrawerOpen(false); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md p-4">
          <div className="flex flex-col gap-1 border-b border-border">
            <h2 className="font-heading font-medium text-foreground">{t('till.customer')}</h2>
            <p className="text-sm text-muted-foreground">{t('till.customerSheetDesc')}</p>
          </div>

          {selectedCustomer || oneTime && oneTime.name.trim() ? (
            <div className="w-full rounded-full bg-primary/10 p-2.5">
              <Avatar
                className="size-6 bg-primary p-1"
                aria-label={t('till.customerAvatar')}
              >
                <div className="size-4 rounded-full bg-primary/20">
                  {(selectedCustomer?.name || oneTime?.name || '')
                    .split(' ')
                    .slice(0, 2)
                    .map((word) => word?.[0] || '')
                    .join('')}
                </div>
              </Avatar>
              <span className="truncate ml-3 flex-1">
                {selectedCustomer?.name || oneTime?.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2"
                onClick={() => {
                  setCustomerId('0');
                  setOneTime(null);
                  setDeliveryName('');
                  setDeliveryContact('');
                  setDeliveryAddress('');
                }}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 rounded-lg bg-muted p-1.5">
              <TabsTrigger value="search" className="text-sm font-medium">
                {t('till.tabSearch')}
              </TabsTrigger>
              <TabsTrigger value="new" className="text-sm font-medium">
                {t('till.tabNew')}
              </TabsTrigger>
              <TabsTrigger value="one-time" className="text-sm font-medium">
                {t('till.oneTime')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-2 pt-2">
              <Input
                id="drawer-search"
                value={drawerQuery}
                onChange={(e) => setDrawerQuery(e.target.value)}
                placeholder={t('till.nameOrPhone')}
                autoFocus
              />
              {drawerQuery.trim() && (
                <div className="rounded-md border max-h-48 overflow-y-auto">
                  {drawerResults.length === 0 ? (
                    <p className="p-3 text-center text-sm text-muted-foreground">{t('till.noCustomers')}</p>
                  ) : (
                    drawerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => chooseSavedCustomer(c.id, c.name)}
                        className="flex w-full items-center justify-between border-b p-2.5 text-left transition-colors last:border-b-0 hover:bg-accent"
                      >
                        <span className="truncate font-medium text-md">{c.name}</span>
                        <span className="ml-3 shrink-0 text-xs text-muted-foreground">{c.phone || '—'}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-2 pt-2">
              <p className="text-sm text-muted-foreground">
                {t('till.newCustomerHint')}
              </p>
              <div className="space-y-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('common.name')}
                />
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder={t('till.phone')}
                  inputMode="tel"
                />
                <Input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder={t('till.address')}
                  className="w-full"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (!newName.trim()) {
                      setError(t('common.nameRequired'));
                      return;
                    }
                    setError(null);
                    quickCreateCustomer();
                  }}
                  className="w-full"
                >
                  {t('till.saveAttach')}
                </Button>
                {error && (
                  <p className="mt-1 text-xs text-destructive">{error}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="one-time" className="space-y-2 pt-2">
              <p className="text-sm text-muted-foreground">
                {t('till.oneTimeHint')}
              </p>
              <div className="space-y-2">
                <Input
                  value={draftOneTime.name}
                  onChange={(e) => setDraftOneTime((d) => ({ ...d, name: e.target.value }))}
                  placeholder={t('common.name')}
                />
                <Input
                  value={draftOneTime.phone}
                  onChange={(e) => setDraftOneTime((d) => ({ ...d, phone: e.target.value }))}
                  placeholder={t('till.phone')}
                  inputMode="tel"
                />
                <Input
                  value={draftOneTime.address}
                  onChange={(e) => setDraftOneTime((d) => ({ ...d, address: e.target.value }))}
                  placeholder={t('till.address')}
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (!draftOneTime.name.trim()) {
                      setError(t('common.nameRequired'));
                      return;
                    }
                    setError(null);
                    attachOneTime();
                  }}
                  className="w-full"
                >
                  {t('till.attachToOrder')}
                </Button>
                {error && (
                  <p className="mt-1 text-xs text-destructive">{error}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-auto border-t border-border pt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setCustomerId('0');
                setOneTime(null);
                setDeliveryName('');
                setDeliveryContact('');
                setDeliveryAddress('');
                setCustomerDrawerOpen(false);
              }}
            >
              {t('till.keepWalkin')}
            </Button>
            <Button type="button">{t('till.done')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
