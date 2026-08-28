import { useEffect, useState } from 'react';
import { Check, ChevronDown, Pencil, Search, Trash2, Utensils, icons, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { api, Category, Product, ProductComponent, getUploadsBase } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';
import PhotoPicker from '../components/PhotoPicker';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { ScrollArea } from '../components/ui/scroll-area';
import { highlight } from '../lib/highlight';
import { isLowStock, getStockQuantity, getLowStockThreshold } from '../lib/stock';
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
  loading?: boolean;
};

type ComponentForm = {
  id: string;
  quantity: string;
};

type OptionForm = { name: string; priceDelta: string };
type GroupForm = { name: string; options: OptionForm[] };
type SizeForm = { name: string; price: string; cost: string };

const emptyProduct = {
  id: '',
  name: '',
  price: '',
  cost: '', // Cost per item (Advanced)
  category: '',
  category_id: '',
  featureAsDailySpecial: false, // Feature as daily special (Essentials)
  img: '', // Photo optional (Essentials)
  components: [] as ComponentForm[],
  sizes: [] as SizeForm[],
  modifiers: [] as GroupForm[],
};

const emptyComponent = {
  id: '',
  quantity: '1',
};

const emptyOption: OptionForm = { name: '', priceDelta: '0' };
const iconLibrary = icons as Record<string, LucideIcon>;
const categoryIcons = Object.entries(iconLibrary).sort(([first], [second]) => first.localeCompare(second));

export default function CatalogView({
  products,
  categories,
  symbol,
  canProducts,
  canCategories,
  onChanged,
  loading = false,
}: Props) {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<'products' | 'categories'>(
    canProducts ? 'products' : 'categories'
  );
  const [list, setList] = useState(products);
  const [cats, setCats] = useState(categories);
  const [form, setForm] = useState(emptyProduct);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Utensils');
  const [iconQuery, setIconQuery] = useState('');
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ kind: 'product' | 'bulk' | 'category'; id?: number } | null>(null);
  const uploads = getUploadsBase();

  useEffect(() => {
    setList(products);
    setCats(categories);
    setSelected((prev) => prev.filter((id) => products.some((p) => p.id === id)));
  }, [products, categories]);

  const saveProduct = async () => {
    if (!form.name.trim()) {
      setError(t('common.nameRequired'));
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append('id', form.id);
    fd.append('name', form.name.trim());
    fd.append('price', form.price || '0');
    fd.append('cost', form.cost || '0');
    fd.append('category', form.category);
    fd.append('category_id', form.category_id || '');
    fd.append('hot', form.featureAsDailySpecial ? '1' : '0');
    fd.append('img', form.img);
    fd.append('components', JSON.stringify(form.components.filter((c) => c.id).map((c) => ({ id: Number(c.id), quantity: Number(c.quantity) || 1 }))));
    fd.append(
      'sizes',
      JSON.stringify(
        form.sizes
          .filter((s) => s.name.trim())
          .map((s, i) => ({
            name: s.name.trim(),
            price: parseFloat(s.price) || 0,
            cost: parseFloat(s.cost) || 0,
            position: i,
          }))
      )
    );
    fd.append(
      'modifiers',
      JSON.stringify(
        form.modifiers
          .filter((g) => g.name.trim())
          .map((g) => ({
            name: g.name.trim(),
            options: g.options
              .filter((o) => o.name.trim())
              .map((o) => ({ name: o.name.trim(), priceDelta: parseFloat(o.priceDelta) || 0 })),
          }))
      )
    );
    await api.saveProduct(fd);
    setForm(emptyProduct);
    await onChanged();
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

  const addGroup = (kind: 'modifiers') => {
    setForm((prev) => ({
      ...prev,
      [kind]: [...prev[kind], { name: '', options: [{ name: '', priceDelta: '0' }] }],
    }));
  };

  const removeGroup = (kind: 'modifiers', index: number) => {
    setForm((prev) => ({
      ...prev,
      [kind]: prev[kind].filter((_, i) => i !== index),
    }));
  };

  const updateGroup = (kind: 'modifiers', index: number, field: 'name', value: string) => {
    setForm((prev) => ({
      ...prev,
      [kind]: prev[kind].map((g, i) => (i === index ? { ...g, [field]: value } : g)),
    }));
  };

  const addOption = (kind: 'modifiers', groupIndex: number) => {
    setForm((prev) => ({
      ...prev,
      [kind]: prev[kind].map((g, i) =>
        i === groupIndex ? { ...g, options: [...g.options, { ...emptyOption }] } : g
      ),
    }));
  };

  const removeOption = (kind: 'modifiers', groupIndex: number, optionIndex: number) => {
    setForm((prev) => ({
      ...prev,
      [kind]: prev[kind].map((g, i) =>
        i === groupIndex ? { ...g, options: g.options.filter((_, j) => j !== optionIndex) } : g
      ),
    }));
  };

  const updateOption = (
    kind: 'modifiers',
    groupIndex: number,
    optionIndex: number,
    field: 'name' | 'priceDelta',
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [kind]: prev[kind].map((g, i) =>
        i === groupIndex
          ? { ...g, options: g.options.map((o, j) => (j === optionIndex ? { ...o, [field]: value } : o)) }
          : g
      ),
    }));
  };

  const editProduct = (p: Product) => {
    setForm({
      id: String(p.id),
      name: p.name,
      price: String(p.price),
      cost: String(p.cost ?? '0'),
      category: p.category,
      category_id: p.category_id ? String(p.category_id) : '',
      featureAsDailySpecial: !!p.featureAsDailySpecial || p.hot,
      img: p.img || '',
      components: (p.components || []).map((c) => ({
        id: String(c.id),
        quantity: String(c.quantity),
      })),
      sizes: (p.sizes || []).map((s) => ({
        name: s.name,
        price: String(s.price),
        cost: String(s.cost ?? 0),
      })),
      modifiers: (p.modifiers || []).map((g) => ({
        name: g.name,
        options: g.options.map((o) => ({ name: o.name, priceDelta: String(o.priceDelta) })),
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

  const saveCategory = async () => {
    if (!catName.trim()) return;
    if (editCatId) {
      await api.updateCategory({ id: editCatId, name: catName.trim(), icon: catIcon });
    } else {
      await api.saveCategory({ name: catName.trim(), icon: catIcon });
    }
    setCatName('');
    setCatIcon('Utensils');
    setIconQuery('');
    setEditCatId(null);
    await onChanged();
  };

  const selectedCategoryIcon = iconLibrary[catIcon] || Utensils;

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
      setError(err instanceof Error ? err.message : t('common.deleteFailed'));
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
              {t('catalog.products')}
            </Button>
          )}
          {canCategories && (
            <Button
              variant={tab === 'categories' ? 'default' : 'outline'}
              onClick={() => setTab('categories')}
            >
              {t('catalog.categories')}
            </Button>
          )}
        </div>
        {canProducts && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="destructive" disabled={busy || !selected.length} onClick={bulkDelete}>
              {t('catalog.deleteSelected', { count: selected.length })}
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
              <CardTitle>{t(form.id ? 'catalog.editProduct' : 'catalog.newProduct')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">{t('catalog.essentials')}</h3>
                  <p className="text-xs text-muted-foreground">{t('catalog.essentialsHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-name">{t('common.name')}</Label>
                  <Input
                    id="product-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('catalog.productName')}
                  />
                </div>

                {form.sizes.length === 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="product-price">{t('common.price')}</Label>
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
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('catalog.pricedBySize')}
                  </p>
                )}

                <PhotoPicker
                  value={form.img}
                  onChange={(img) => setForm({ ...form, img })}
                  label={t('catalog.photoLabel')}
                />

                <div className="space-y-2">
                  <Label htmlFor="product-category">{t('common.section')}</Label>
                  <Select value={form.category_id} onValueChange={(value) => setForm({ ...form, category_id: value || '' })}>
                    <SelectTrigger id="product-category">
                      <SelectValue placeholder={t('catalog.selectSection')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('catalog.none')}</SelectItem>
                      {cats.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="product-hot"
                    checked={form.featureAsDailySpecial}
                    onCheckedChange={(checked) => setForm({ ...form, featureAsDailySpecial: !!checked })}
                  />
                  <Label htmlFor="product-hot">{t('catalog.dailySpecial')}</Label>
                </div>
              </section>

              <section className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 p-4 text-left"
                  aria-expanded={showAdvanced}
                >
                  <div>
                    <h3 className="text-sm font-semibold">{t('catalog.advanced')}</h3>
                    <p className="text-xs text-muted-foreground">{t('catalog.advancedHint')}</p>
                  </div>
                  <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', showAdvanced && 'rotate-180')} />
                </button>
                {showAdvanced && (
                  <div className="space-y-4 border-t p-4">
                    {form.sizes.length === 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="product-cost">{t('catalog.costPerItem')}</Label>
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
                    )}

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t('catalog.comboComponents')}</Label>
                        <Button variant="outline" size="sm" onClick={addComponent}>
                          {t('catalog.addComponent')}
                        </Button>
                      </div>
                      {form.components.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t('catalog.noComponents')}
                        </p>
                      )}
                      {form.components.map((comp, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Select
                            value={comp.id}
                            onValueChange={(value) => updateComponent(idx, 'id', value || '')}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder={t('catalog.selectProduct')} />
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
                            placeholder={t('common.qty')}
                            className="w-20"
                          />
                          {comp.id && list.find((p) => p.id === Number(comp.id)) && (
                            <Badge variant="outline" className="text-xs flex-1">
                              {list.find((p) => p.id === Number(comp.id))!.name}
                            </Badge>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => removeComponent(idx)} aria-label={t('catalog.removeComponent')}>
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>
                          {t(form.sizes.length > 0 ? 'catalog.sellsBySize' : 'catalog.sizes')}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {t(form.sizes.length > 0 ? 'catalog.sizesHintLike' : 'catalog.sizesHintEmpty')}
                          </span>
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setForm((prev) => ({ ...prev, sizes: [...prev.sizes, { name: '', price: '', cost: '' }] }))}
                        >
                          {t('catalog.addSize')}
                        </Button>
                      </div>
                      {form.sizes.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t('catalog.noSizes')}
                        </p>
                      )}
                      {form.sizes.map((s, si) => (
                        <div key={si} className="flex items-center gap-2">
                          <Input
                            value={s.name}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                sizes: prev.sizes.map((x, i) => (i === si ? { ...x, name: e.target.value } : x)),
                              }))
                            }
                            placeholder={t('catalog.sizeExample')}
                            className="h-9 flex-1"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">{symbol}</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={s.price}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  sizes: prev.sizes.map((x, i) => (i === si ? { ...x, price: e.target.value } : x)),
                                }))
                              }
                              placeholder={t('common.price')}
                              className="h-9 w-20"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">{symbol}</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={s.cost}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  sizes: prev.sizes.map((x, i) => (i === si ? { ...x, cost: e.target.value } : x)),
                                }))
                              }
                              placeholder={t('common.cost')}
                              className="h-9 w-20"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setForm((prev) => ({ ...prev, sizes: prev.sizes.filter((_, i) => i !== si) }))}
                            aria-label={t('catalog.removeSize')}
                          >
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {(['modifiers'] as const).map((kind) => (
                      <div key={kind} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>
                            {t('catalog.modifiers')}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              {t('catalog.modifiersHint')}
                            </span>
                          </Label>
                          <Button variant="outline" size="sm" onClick={() => addGroup(kind)}>
                            {t('catalog.addModifierGroup')}
                          </Button>
                        </div>
                        {form[kind].length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            {t('catalog.noModifiers')}
                          </p>
                        )}
                        {form[kind].map((group, gi) => (
                          <div key={gi} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={group.name}
                                onChange={(e) => updateGroup(kind, gi, 'name', e.target.value)}
                                placeholder={t('catalog.groupExample')}
                                className="h-9 flex-1"
                              />
                              <Button variant="ghost" size="icon" onClick={() => removeGroup(kind, gi)} aria-label={t('catalog.removeGroup')}>
                                ✕
                              </Button>
                            </div>
                            {group.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2 pl-2">
                                <Input
                                  value={opt.name}
                                  onChange={(e) => updateOption(kind, gi, oi, 'name', e.target.value)}
                                  placeholder={t('catalog.optionName')}
                                  className="h-9 flex-1"
                                />
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">{symbol}</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={opt.priceDelta}
                                    onChange={(e) => updateOption(kind, gi, oi, 'priceDelta', e.target.value)}
                                    placeholder="0.00"
                                    className="h-9 w-24"
                                  />
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeOption(kind, gi, oi)} aria-label={t('catalog.removeOption')}>
                                  ✕
                                </Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addOption(kind, gi)}>
                              {t('catalog.addOption')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              <div className="flex gap-2">
                <Button onClick={saveProduct} className="flex-1">
                  {t(form.id ? 'catalog.updateProduct' : 'catalog.addProduct')}
                </Button>
                {form.id && (
                  <Button variant="outline" onClick={() => setForm(emptyProduct)} className="flex-1">
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('catalog.productList')}</CardTitle>
              <div className="w-64">
                <Input
                  placeholder={t('catalog.searchPlaceholder')}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[80vh] overflow-auto">
              <Table>
<TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label={t('catalog.selectVisible')}
                      />
                    </TableHead>
                    <TableHead className="w-16">{t('common.image')}</TableHead>
                    <TableHead>{t('common.id')}</TableHead>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.price')}</TableHead>
                    <TableHead className="w-64 text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={`sk-${i}`}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-40" /></TableCell>
                      </TableRow>
                    ))
                  ) : (
                  <>
                  {visible.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                          aria-label={t('common.selectItem', { name: p.name })}
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{p.name}</span>
                          {isLowStock(p) && (
                            <Badge variant="destructive" className="text-xs">
                              {t('common.lowStock')}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.category || t('common.uncategorized')}</div>
                        {isLowStock(p) && (
                          <p className="text-xs text-destructive mt-1">
                            {t('catalog.onlyLeft', { left: getStockQuantity(p), threshold: getLowStockThreshold(p) })}
                          </p>
                        )}
                      </TableCell>
                        <TableCell className="font-medium"><span className={highlight.blue}>{symbol}{Number(p.price).toFixed(2)}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" aria-label={t('common.editItem', { name: p.name })} onClick={() => editProduct(p)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t('common.deleteItem', { name: p.name })}
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
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        {t('catalog.noProducts')}
                      </TableCell>
                    </TableRow>
                  )}
                  </>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'categories' && canCategories && (
        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t(editCatId ? 'catalog.editCategory' : 'catalog.newCategory')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">{t('common.name')}</Label>
                <Input
                  id="cat-name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveCategory();
                  }}
                  placeholder={t('catalog.categoryExample')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.icon')}</Label>
                <Popover>
                  <PopoverTrigger
                    aria-label={t('catalog.chooseIcon')}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center gap-2">
                      {(() => {
                        const Icon = selectedCategoryIcon;
                        return <Icon className="size-4 text-primary" />;
                      })()}
                      {catIcon}
                    </span>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-2">
                    <div className="relative mb-2">
                      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label={t('catalog.searchIcons')}
                        value={iconQuery}
                        onChange={(event) => setIconQuery(event.target.value)}
                        placeholder={t('catalog.searchIconsPlaceholder')}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="h-64">
                      <div className="grid grid-cols-4 gap-1 pr-3">
                        {categoryIcons
                          .filter(([name]) => name.toLowerCase().includes(iconQuery.trim().toLowerCase()))
                          .map(([name, Icon]) => (
                            <Button
                              key={name}
                              type="button"
                              variant={catIcon === name ? 'secondary' : 'ghost'}
                              size="icon"
                              className="relative"
                              aria-label={t('catalog.useIcon', { name })}
                              title={name}
                              onClick={() => {
                                setCatIcon(name);
                                setIconQuery('');
                              }}
                            >
                              <Icon className="size-4" />
                              {catIcon === name && <Check className="absolute size-3 text-primary" />}
                            </Button>
                          ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">{t('catalog.iconsHint')}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void saveCategory()} disabled={!catName.trim()} className="flex-1">
                  {t(editCatId ? 'catalog.updateCategory' : 'catalog.addCategory')}
                </Button>
                {editCatId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditCatId(null);
                      setCatName('');
                      setCatIcon('Utensils');
                      setIconQuery('');
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('catalog.categories')}</CardTitle>
            </CardHeader>
            <CardContent>
              {cats.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {t('catalog.noCategories')}
                </p>
              ) : (
                <div className="max-h-[80vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.section')}</TableHead>
                      <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cats.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {(() => {
                              const Icon = iconLibrary[c.icon] || Utensils;
                              return <Icon className="size-4 text-primary" />;
                            })()}
                            <span className={highlight.blue}>{c.name}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t('common.editItem', { name: c.name })}
                              onClick={() => {
                                setCatName(c.name);
                                setCatIcon(c.icon || 'Utensils');
                                setIconQuery('');
                                setEditCatId(c.id);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              aria-label={t('common.deleteItem', { name: c.name })}
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stock Adjustment Dialog */}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === 'bulk'
                ? t('catalog.deleteSelectedTitle', { count: selected.length })
                : pending?.kind === 'category'
                ? t('catalog.deleteThisCategory')
                : t('catalog.deleteThisProduct')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.cannotUndo')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
