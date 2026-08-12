import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api, Category, Product, ProductComponent, getUploadsBase } from '../api/client';
import PhotoPicker from '../components/PhotoPicker';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

type Props = {
  products: Product[];
  categories: Category[];
  symbol: string;
  canProducts: boolean;
  canCategories: boolean;
  onChanged: () => Promise<void>;
};

type ComponentForm = {
  id: string;
  quantity: string;
};

const emptyProduct = {
  id: '',
  name: '',
  price: '',
  cost: '',
  category: '',
  quantity: '0',
  trackStock: false,
  lowStockThreshold: 10,
  img: '',
  components: [] as ComponentForm[],
};

const emptyComponent = {
  id: '',
  quantity: '1',
};

export default function CatalogView({
  products,
  categories,
  symbol,
  canProducts,
  canCategories,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<'products' | 'categories'>(
    canProducts ? 'products' : 'categories'
  );
  const [list, setList] = useState(products);
  const [cats, setCats] = useState(categories);
  const [form, setForm] = useState(emptyProduct);
  const [catName, setCatName] = useState('');
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'restock' | 'wastage' | 'adjustment'>('restock');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [pending, setPending] = useState<{ kind: 'product' | 'bulk' | 'category'; id?: number } | null>(null);
  const uploads = getUploadsBase();

  useEffect(() => {
    setList(products);
    setCats(categories);
    setSelected((prev) => prev.filter((id) => products.some((p) => p.id === id)));
  }, [products, categories]);

  const saveProduct = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append('id', form.id);
    fd.append('name', form.name.trim());
    fd.append('price', form.price || '0');
    fd.append('cost', form.cost || '0');
    fd.append('category', form.category);
    fd.append('quantity', form.quantity || '0');
    fd.append('stock', form.trackStock ? '1' : 'on');
    fd.append('img', form.img);
    fd.append('components', JSON.stringify(form.components.filter((c) => c.id).map((c) => ({ id: Number(c.id), quantity: Number(c.quantity) || 1 }))));
    await api.saveProduct(fd);
    setForm(emptyProduct);
    await onChanged();
  };

  const openAdjustDialog = (product: Product, type: 'restock' | 'wastage' | 'adjustment') => {
    setAdjustProduct(product);
    setAdjustType(type);
    setAdjustQty('');
    setAdjustReason('');
  };

  const handleAdjust = async () => {
    if (!adjustProduct || !adjustQty.trim()) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty === 0) return;

    const user = JSON.parse(localStorage.getItem('pos_user') || '{}');
    const userId = user.id || 0;
    const userName = user.fullname || '';

    setBusy(true);
    try {
      await api.adjustStock(adjustProduct.id, {
        type: adjustType,
        quantityChange: adjustType === 'wastage' ? -Math.abs(qty) : qty,
        reason: adjustReason,
        userId,
        userName,
      });
      setAdjustProduct(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed');
    } finally {
      setBusy(false);
    }
  };

  const addComponent = () => {
    setForm((prev) => ({
      ...prev,
      components: [...prev.components, emptyComponent],
    }));
  };

  const removeComponent = (index: number) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  const updateComponent = (index: number, field: 'id' | 'quantity', value: string) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  };

  const editProduct = (p: Product) => {
    setForm({
      id: String(p.id),
      name: p.name,
      price: String(p.price),
      cost: String(p.cost ?? '0'),
      category: p.category,
      quantity: String(p.quantity),
      trackStock: !!p.trackStock,
      lowStockThreshold: p.lowStockThreshold || 10,
      img: p.img || '',
      components: (p.components || []).map((c) => ({
        id: String(c.id),
        quantity: String(c.quantity),
      })),
    });
    setTab('products');
  };

  const removeProduct = (id: number) => {
    setPending({ kind: 'product', id });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const visible = list.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(filter.toLowerCase()) ||
      String(p.id).includes(filter)
  );

  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.includes(p.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visible.map((p) => p.id));
      setSelected((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...visible.map((p) => p.id)])));
    }
  };

  const bulkDelete = () => {
    if (!selected.length) return;
    setPending({ kind: 'bulk' });
  };

  const seedDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.seedDemo();
      await onChanged();
      toast.success(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setBusy(false);
    }
  };

  const saveCategory = async () => {
    if (!catName.trim()) return;
    if (editCatId) {
      await api.updateCategory({ id: editCatId, name: catName.trim() });
    } else {
      await api.saveCategory({ name: catName.trim() });
    }
    setCatName('');
    setEditCatId(null);
    await onChanged();
  };

  const removeCategory = (id: number) => {
    setPending({ kind: 'category', id });
  };

  const confirmPending = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'product' && pending.id != null) {
        await api.deleteProduct(pending.id);
      } else if (pending.kind === 'bulk') {
        await api.deleteProducts(selected);
        setSelected([]);
      } else if (pending.kind === 'category' && pending.id != null) {
        await api.deleteCategory(pending.id);
      }
      setPending(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {canProducts && (
            <Button
              variant={tab === 'products' ? 'default' : 'outline'}
              onClick={() => setTab('products')}
            >
              Products
            </Button>
          )}
          {canCategories && (
            <Button
              variant={tab === 'categories' ? 'default' : 'outline'}
              onClick={() => setTab('categories')}
            >
              Categories
            </Button>
          )}
        </div>
        {canProducts && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" disabled={busy} onClick={seedDemo}>
              Seed demo
            </Button>
            <Button variant="destructive" disabled={busy || !selected.length} onClick={bulkDelete}>
              Delete selected ({selected.length})
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {tab === 'products' && canProducts && (
        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>{form.id ? 'Edit product' : 'New product'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Product name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-price">Price</Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-cost">Cost (COGS)</Label>
                <Input
                  id="product-cost"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value || '' })}>
                  <SelectTrigger id="product-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="track-stock"
                  checked={form.trackStock}
                  onCheckedChange={(checked) => setForm({ ...form, trackStock: checked })}
                />
                <Label htmlFor="track-stock">Track inventory</Label>
              </div>

              {form.trackStock && (
                <div className="space-y-2">
                  <Label htmlFor="product-quantity">Quantity on hand</Label>
                  <Input
                    id="product-quantity"
                    type="number"
                    min={0}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
              )}

              {form.trackStock && (
                <div className="space-y-2">
                  <Label htmlFor="product-low-stock">Low stock threshold</Label>
                  <Input
                    id="product-low-stock"
                    type="number"
                    min={1}
                    value={form.lowStockThreshold || 10}
                    onChange={(e) => setForm({ ...form, lowStockThreshold: parseInt(e.target.value, 10) || 10 })}
                    placeholder="10"
                  />
                </div>
              )}

              <PhotoPicker
                value={form.img}
                onChange={(img) => setForm({ ...form, img })}
              />

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Combo Components</Label>
                  <Button variant="outline" size="sm" onClick={addComponent}>
                    + Add Component
                  </Button>
                </div>
                {form.components.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No components. Add products to create a combo (e.g., Meal = Burger + Fries + Drink).
                    Components are printed on receipts but do not affect stock.
                  </p>
                )}
                {form.components.map((comp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={comp.id}
                      onValueChange={(value) => updateComponent(idx, 'id', value || '')}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {list.filter((p) => p.id !== Number(form.id) || !form.id).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} ({symbol}{Number(p.price).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={comp.quantity}
                      onChange={(e) => updateComponent(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-20"
                    />
                    {comp.id && list.find((p) => p.id === Number(comp.id)) && (
                      <Badge variant="outline" className="text-xs flex-1">
                        {list.find((p) => p.id === Number(comp.id))!.name}
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeComponent(idx)} aria-label="Remove component">
                      ✕
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button onClick={saveProduct} className="flex-1">
                  {form.id ? 'Update' : 'Add'} product
                </Button>
                {form.id && (
                  <Button variant="outline" onClick={() => setForm(emptyProduct)} className="flex-1">
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Product List</CardTitle>
              <div className="w-64">
                <Input
                  placeholder="Search name, category, or ID"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
<TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label="Select all visible"
                      />
                    </TableHead>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Low Stock</TableHead>
                    <TableHead className="w-64 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        {p.img ? (
                          <img
                            src={`${uploads}/${p.img}`}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover border"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{p.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.category || 'Uncategorized'}</div>
                      </TableCell>
                      <TableCell className="font-medium">{symbol}{Number(p.price).toFixed(2)}</TableCell>
                      <TableCell>
                        {p.trackStock ? (
                          <>
                            <span className={p.quantity <= 0 ? 'text-destructive font-medium' : ''}>
                              {p.quantity}
                            </span>
                            {p.quantity <= 0 && <Badge variant="destructive" className="ml-1 text-xs">Out of stock</Badge>}
                            {p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 10) && (
                              <Badge variant="secondary" className="ml-1 text-xs">Low stock</Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.trackStock ? (
                          <Badge variant="outline" className="text-xs">{p.lowStockThreshold || 10}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.trackStock && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openAdjustDialog(p, 'restock')}>
                                + Restock
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openAdjustDialog(p, 'wastage')}>
                                - Wastage
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => editProduct(p)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${p.name}`}
                            onClick={() => removeProduct(p.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!visible.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No products yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'categories' && canCategories && (
        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>{editCatId ? 'Edit category' : 'New category'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveCategory();
                  }}
                  placeholder="e.g. Beverages"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void saveCategory()} disabled={!catName.trim()} className="flex-1">
                  {editCatId ? 'Update' : 'Add category'}
                </Button>
                {editCatId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditCatId(null);
                      setCatName('');
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {cats.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No categories yet. Add one above.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cats.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${c.name}`}
                              onClick={() => {
                                setCatName(c.name);
                                setEditCatId(c.id);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Delete ${c.name}`}
                              onClick={() => removeCategory(c.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stock Adjustment Dialog */}
      <Dialog open={!!adjustProduct} onOpenChange={(open) => !open && setAdjustProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustType === 'restock' ? 'Restock' : adjustType === 'wastage' ? 'Record Wastage' : 'Adjust Stock'}
              {adjustProduct && <span className="ml-2 text-base font-normal text-muted-foreground">— {adjustProduct.name}</span>}
            </DialogTitle>
            <DialogDescription>
              {adjustType === 'restock'
                ? 'Add inventory to increase stock on hand.'
                : adjustType === 'wastage'
                ? 'Record items that were wasted, damaged, or expired.'
                : 'Manually adjust stock level (positive or negative).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adjust-type">Type</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as 'restock' | 'wastage' | 'adjustment')}>
                <SelectTrigger id="adjust-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restock (+)</SelectItem>
                  <SelectItem value="wastage">Wastage (-)</SelectItem>
                  <SelectItem value="adjustment">Adjustment (±)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-qty">Quantity</Label>
              <Input
                id="adjust-qty"
                type="number"
                step={1}
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder={adjustType === 'wastage' ? 'Quantity wasted' : 'Quantity to add'}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Input
                id="adjust-reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., New delivery, Damaged goods, Inventory count correction"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Current stock: <span className="font-medium">{adjustProduct?.quantity || 0}</span>
              {' '}
              {adjustProduct?.trackStock && (
                <>
                  | Low stock threshold: <span className="font-medium">{adjustProduct?.lowStockThreshold || 10}</span>
                </>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustProduct(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={busy || !adjustQty.trim()}>
              {busy ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === 'bulk'
                ? `Delete ${selected.length} selected product(s)?`
                : pending?.kind === 'category'
                ? 'Delete this category?'
                : 'Delete this product?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}