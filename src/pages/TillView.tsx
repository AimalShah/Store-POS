import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Check,
  Clock,
  CreditCard,
  Minus,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  Timer,
} from 'lucide-react';
import {
  api,
  CartItem,
  Category,
  Customer,
  Product,
  Settings,
  Shift,
  Transaction,
  getUploadsBase,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import CustomerSelect from '../components/CustomerSelect';
import Invoice from '../components/Invoice';
import PaymentPad from '../components/PaymentPad';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '../components/ui/card';
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
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { ScrollArea } from '../components/ui/scroll-area';
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
}: Props) {
  const { user, apiInfo } = useAuth();
  const scanRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [customerId, setCustomerId] = useState('0');
  const [discount, setDiscount] = useState(0);
  const [activeHoldId, setActiveHoldId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHolds, setShowHolds] = useState(false);
  const [holds, setHolds] = useState<Transaction[]>([]);

  // Shift State
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);

  const refreshShift = async () => {
    try {
      const shift = await api.getOpenShift(settings?.till || 1);
      setCurrentShift(shift);
    } catch {
      setCurrentShift(null);
    } finally {
      setShiftLoading(false);
    }
  };

  // Payment State
  const [showPay, setShowPay] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [amountInput, setAmountInput] = useState('');
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);

  const [invoice, setInvoice] = useState<Transaction | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const symbol = settings?.symbol || '$';
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
    refreshShift();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length && currentShift && currentShift.status === 'open') openPay();
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
  }, [cart, showPay, currentShift]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = categoryFilter === 'all' || p.category === categoryFilter;
      if (!q) return catOk;
      return catOk && (p.name.toLowerCase().includes(q) || String(p.id).includes(q));
    });
  }, [products, query, categoryFilter]);

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

  const stockBadge = (p: Product) => {
    if (!p.stock) return null;
    if (p.quantity <= 0) {
      return <Badge variant="destructive">Out of stock</Badge>;
    }
    if (p.quantity <= 5) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">{p.quantity} left</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">{p.quantity} in stock</Badge>;
  };

  const addToCart = (product: Product) => {
    if (product.stock && product.quantity <= 0) {
      setError(`${product.name} is out of stock`);
      return;
    }
    setError(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (product.stock && existing.quantity >= product.quantity) {
          setError(`Only ${product.quantity} available for ${product.name}`);
          return prev;
        }
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          stock: product.quantity,
          components: product.components,
        },
      ];
    });
  };

  const setQty = (id: number, quantity: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const setItemNote = (id: number, note: string) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)));
  };

  const setItemDiscount = (id: number, discountType: 'flat' | 'percent', discountValue: number) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, discountType, discountValue } : i)));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setActiveHoldId(null);
    setCustomerId('0');
    setError(null);
    scanRef.current?.focus();
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
        setError(`No product found for "${code}"`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    }
  };

  const openPay = () => {
    setPaymentLines([]);
    setSelectedMethod('cash');
    setAmountInput('');
    setShowPay(true);
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
      customer_name: customer?.name || 'Walk-in Customer',
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
      shift_id: currentShift?.id,
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
      setError(err instanceof Error ? err.message : 'Could not hold order');
    }
  };

  const completeSale = async () => {
    // Check if a shift is open
    if (!currentShift || currentShift.status !== 'open') {
      setError('No shift is open. Please open a shift before completing a sale.');
      setShowPay(false);
      return;
    }

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
      setError('Payment lines do not cover full order amount');
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
      customer_name: customer?.name || 'Walk-in Customer',
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
      shift_id: currentShift.id,
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
      setInvoice({
        ...body,
        _id: savedId,
        id: savedId,
        ref_number: savedRef,
      });
      setShowInvoice(true);
      clearCart();
      setShowPay(false);
      await onRefresh();
      await refreshHolds();
      setTimeout(() => window.print(), 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale completion failed');
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
    setShowHolds(false);
    scanRef.current?.focus();
  };

  const discardHold = async (id: number) => {
    try {
      await api.deleteTransaction(id);
      await refreshHolds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not discard order');
    }
  };

  return (
    <div className="flex h-full flex-col lg:flex-row gap-4 p-4 bg-muted/20">
      {error && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-md bg-destructive px-4 py-3 text-destructive-foreground shadow-md">
          <AlertCircle className="size-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive-foreground hover:bg-destructive/80"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Left Panel: Product Grid & Search */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        {/* Search Bar & Category Chips */}
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={scanRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onScan();
                }}
                placeholder="Scan barcode or search product — Enter to add"
                className="pl-9 h-11 text-base"
                autoFocus
              />
            </div>
            <Button onClick={onScan} className="h-11 px-6 text-base">
              Add
            </Button>
          </div>

          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-1">
              <Button
                variant={categoryFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-9 px-4 text-sm rounded-full"
                onClick={() => setCategoryFilter('all')}
              >
                All Categories
              </Button>
              {categories.map((c) => (
                <Button
                  key={c.id}
                  variant={categoryFilter === c.name ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 px-4 text-sm rounded-full"
                  onClick={() => setCategoryFilter(c.name)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Product Grid */}
        <ScrollArea className="flex-1 rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((p) => {
              const isOut = !!p.stock && p.quantity <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={isOut}
                  className={`group relative flex flex-col justify-between rounded-lg border p-3 text-left transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    isOut ? 'opacity-50 cursor-not-allowed bg-muted/30' : 'bg-card'
                  }`}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-md bg-muted mb-2 flex items-center justify-center">
                    {p.img ? (
                      <img
                        src={`${uploads}/${p.img}`}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <ShoppingBag className="size-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-2 leading-tight mb-1">{p.name}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-base text-primary">
                        {symbol}
                        {Number(p.price).toFixed(2)}
                      </span>
                      {stockBadge(p)}
                    </div>
                  </div>
                </button>
              );
            })}
            {!filteredProducts.length && (
              <div className="col-span-full py-16 text-center text-muted-foreground">
                No products found matching your search.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel: Cart Card */}
      <Card className="flex flex-col w-full lg:w-[420px] shrink-0 h-full shadow-sm">
        <CardHeader className="pb-3 border-b space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CustomerSelect
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              onCustomersChanged={onRefresh}
            />
            <Button variant="outline" size="sm" onClick={openHolds} className="relative gap-1.5 h-10">
              <Clock className="size-4" />
              <span>Held</span>
              {holdCount > 0 && (
                <Badge variant="default" className="ml-1 px-1.5 py-0.5 text-xs">
                  {holdCount}
                </Badge>
              )}
            </Button>
            {invoice && (
              <Button variant="ghost" size="icon" onClick={() => setShowInvoice(true)} title="Last Receipt">
                <Receipt className="size-4" />
              </Button>
            )}
          </div>

          {/* Shift Status */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2">
              <Timer className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {shiftLoading ? (
                  'Loading shift...'
                ) : currentShift ? (
                  <>
                    Shift #{currentShift.id} — {currentShift.userName} — Float: {symbol}{currentShift.floatAmount.toFixed(2)}
                  </>
                ) : (
                  <span className="text-destructive">No shift open — Open a shift to start selling</span>
                )}
              </span>
            </div>
          </div>
        </CardHeader>

        {/* Cart Item List */}
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            <div className="flex flex-col gap-3">
              {cart.map((item) => {
                const lineTotal = getLineTotal(item);
                const hasDiscount = item.discountValue && item.discountValue > 0;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 bg-card/60 hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-medium text-sm block leading-tight">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {symbol}
                          {item.price.toFixed(2)} each
                        </span>
                      </div>
                      <span className="font-bold text-sm">
                        {symbol}
                        {lineTotal.toFixed(2)}
                      </span>
                    </div>

                    {(item.note || hasDiscount) && (
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {item.note && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-900 border-amber-200">
                            Note: {item.note}
                          </Badge>
                        )}
                        {hasDiscount && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-900 border-green-200">
                            Discount: {item.discountType === 'percent' ? `${item.discountValue}%` : `${symbol}${item.discountValue}`}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Popover>
                          <PopoverTrigger
                            type="button"
                            className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
                          >
                            + Note
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Item Note</Label>
                              <Input
                                value={item.note || ''}
                                onChange={(e) => setItemNote(item.id, e.target.value)}
                                placeholder="e.g. Extra sauce, no onion"
                                className="h-8 text-xs"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>

                        <Popover>
                          <PopoverTrigger
                            type="button"
                            className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
                          >
                            + Discount
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <div className="space-y-3">
                              <Label className="text-xs font-semibold">Line Discount</Label>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={item.discountType === 'flat' ? 'default' : 'outline'}
                                  onClick={() => setItemDiscount(item.id, 'flat', item.discountValue || 0)}
                                  className="flex-1 h-8 text-xs"
                                >
                                  Flat ({symbol})
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={item.discountType === 'percent' ? 'default' : 'outline'}
                                  onClick={() => setItemDiscount(item.id, 'percent', item.discountValue || 0)}
                                  className="flex-1 h-8 text-xs"
                                >
                                  Percent (%)
                                </Button>
                              </div>
                              <Input
                                type="number"
                                min={0}
                                value={item.discountValue || ''}
                                onChange={(e) =>
                                  setItemDiscount(
                                    item.id,
                                    item.discountType || 'flat',
                                    Number(e.target.value) || 0
                                  )
                                }
                                placeholder="Discount amount"
                                className="h-8 text-xs"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          onClick={() => setQty(item.id, item.quantity - 1)}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          onClick={() => setQty(item.id, item.quantity + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!cart.length && (
                <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <ShoppingBag className="size-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium">Cart is empty</p>
                  <p className="text-xs text-muted-foreground">Scan a barcode or select products to start an order</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        {/* Totals & Action Footer */}
        <CardFooter className="flex-col gap-3 border-t p-4 bg-muted/10">
          <div className="w-full space-y-2 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Order Discount ({symbol})</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discount || ''}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-24 h-8 text-right text-xs"
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
              <span>
                {symbol}
                {lineSubtotal.toFixed(2)}
              </span>
            </div>
            {!!taxRate && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span>
                  {symbol}
                  {tax.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-lg font-bold pt-2 border-t text-foreground">
              <span>Total</span>
              <span className="text-primary text-xl">
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
              disabled={!cart.length || !currentShift || currentShift.status !== 'open'}
              className="h-12 text-base font-semibold"
            >
              Pay
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Held Orders Dialog */}
      <Dialog open={showHolds} onOpenChange={setShowHolds}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Held Orders</DialogTitle>
            <DialogDescription>
              Select a parked order to resume or discard it.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[380px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holds.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-xs">{h.ref_number || h.id}</TableCell>
                    <TableCell>{h.customer_name}</TableCell>
                    <TableCell>{(h.items || []).reduce((n, i) => n + i.quantity, 0)}</TableCell>
                    <TableCell className="font-semibold">
                      {symbol}
                      {Number(h.total).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" onClick={() => restoreHold(h)}>
                        Resume
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => discardHold(h.id)}>
                        Discard
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!holds.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No held orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHolds(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-method Split Checkout Dialog */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              Total Due: <span className="font-bold text-foreground">{symbol}{total.toFixed(2)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Payment Method Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={selectedMethod === 'cash' ? 'default' : 'outline'}
                onClick={() => setSelectedMethod('cash')}
                className="flex flex-col gap-1 h-14"
              >
                <Banknote className="size-5" />
                <span className="text-xs">Cash</span>
              </Button>
              <Button
                type="button"
                variant={selectedMethod === 'card' ? 'default' : 'outline'}
                onClick={() => setSelectedMethod('card')}
                className="flex flex-col gap-1 h-14"
              >
                <CreditCard className="size-5" />
                <span className="text-xs">Card</span>
              </Button>
              <Button
                type="button"
                variant={selectedMethod === 'mobile' ? 'default' : 'outline'}
                onClick={() => setSelectedMethod('mobile')}
                className="flex flex-col gap-1 h-14"
              >
                <Smartphone className="size-5" />
                <span className="text-xs">Mobile Wallet</span>
              </Button>
            </div>

            {/* Input & Add Line */}
            <div className="grid gap-2">
              <Label>Tendered / Line Amount ({symbol})</Label>
              <div className="flex gap-2">
                <Input
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder={`Remaining due: ${symbol}${remainingDue.toFixed(2)}`}
                  className="h-11 font-mono text-base text-right"
                  autoFocus
                />
                <Button type="button" onClick={addPaymentLine} className="h-11 px-4">
                  + Add Line
                </Button>
              </div>
            </div>

            {selectedMethod === 'cash' && (
              <PaymentPad
                value={amountInput}
                onChange={setAmountInput}
                due={remainingDue}
                symbol={symbol}
              />
            )}

            {/* Added Payment Lines */}
            {paymentLines.length > 0 && (
              <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                <Label className="text-xs font-semibold text-muted-foreground">Payment Breakdown</Label>
                {paymentLines.map((line, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 border-b last:border-b-0">
                    <span className="capitalize font-medium">{line.method}</span>
                    <div className="flex items-center gap-2">
                      <span>
                        {symbol}{line.amount.toFixed(2)}
                        {line.tendered && line.tendered > line.amount ? ` (Tendered: ${symbol}${line.tendered.toFixed(2)})` : ''}
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
                <span>Remaining Due:</span>
                <span className={`font-bold ${remainingDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {symbol}{remainingDue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Change (Cash lines only):</span>
                <span>{symbol}{totalChange.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPay(false)}>
              Cancel
            </Button>
            <Button
              onClick={completeSale}
              disabled={paymentLines.length === 0 && remainingDue > 0 && !(parseFloat(amountInput) >= total)}
              className="px-8 font-semibold"
            >
              Complete Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable Receipt / Invoice Dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sale Complete &amp; Receipt</DialogTitle>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto border p-4 rounded-md bg-white text-black">
            {invoice && <Invoice tx={invoice} settings={settings} symbol={symbol} />}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowInvoice(false)}>
              Close
            </Button>
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="size-4" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
