import { useEffect, useMemo, useRef, useState } from 'react';
import { api, Customer } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';

type Props = {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  onCustomersChanged?: () => Promise<void> | void;
};

const WALK_IN = { id: '0', name: 'Walk-in', phone: '', email: '', address: '' };

const avatar = 'flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary';
const avatarSm = 'flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary';
const meta = 'flex flex-col';
const metaName = 'text-sm font-medium leading-tight';
const metaSub = 'text-xs text-muted-foreground leading-tight';
const option = 'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent';
const optionActive = 'bg-accent';

export default function CustomerSelect({
  customers,
  value,
  onChange,
  onCustomersChanged,
}: Props) {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const list = useMemo(() => {
    return customers.filter((c) => c.name !== 'Walk-in Customer');
  }, [customers]);

  const selected = useMemo(() => {
    if (value === '0' || !value) return WALK_IN;
    const found = list.find((c) => String(c.id) === String(value));
    return found
      ? {
          id: String(found.id),
          name: found.name,
          phone: (found.phone || '').trim(),
          email: found.email || '',
          address: found.address || '',
        }
      : WALK_IN;
  }, [value, list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const walkIn = { ...WALK_IN };
    const matches = !q
      ? list
      : list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
        );
    if (!q || 'walk-in'.includes(q) || 'walk in'.includes(q)) {
      return [walkIn, ...matches];
    }
    return matches;
  }, [list, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowQuickAdd(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setShowQuickAdd(false);
    setQuery('');
    setError(null);
  };

  const quickAdd = async () => {
    if (!newName.trim()) {
      setError(t('common.nameRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.saveCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
        email: '',
        address: '',
      });
      await onCustomersChanged?.();
      const refreshed = await api.getCustomers();
      const created =
        refreshed
          .filter((c) => c.name === newName.trim())
          .sort((a, b) => b.id - a.id)[0] || null;
      setNewName('');
      setNewPhone('');
      setShowQuickAdd(false);
      if (created) pick(String(created.id));
      else {
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.couldNotSaveCustomer'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        className={`flex h-10 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm hover:bg-accent ${open ? 'ring-1 ring-primary' : ''}`}
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <span className={avatar}>{selected.name.slice(0, 1).toUpperCase()}</span>
        <span className={meta}>
          <strong className={metaName}>{selected.name}</strong>
        </span>
        <span className="ml-auto text-muted-foreground">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          <div className="p-1">
            <input
              ref={inputRef}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-primary"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('till.searchNamePhone')}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  setQuery('');
                }
                if (e.key === 'Enter' && filtered[0]) {
                  e.preventDefault();
                  pick(String(filtered[0].id));
                }
              }}
            />
          </div>

          {error && (
            <div className="mx-1 my-1 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="max-h-56 overflow-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${option} ${String(c.id) === String(value) || (c.id === '0' && value === '0') ? optionActive : ''}`}
                onClick={() => pick(String(c.id))}
              >
                <span className={avatarSm}>{c.name.slice(0, 1).toUpperCase()}</span>
                <span className={meta}>
                  <strong className={metaName}>{c.name}</strong>
                  <span className={metaSub}>
                    {c.phone || (String(c.id) === '0' ? t('till.defaultGuest') : t('till.noPhone'))}
                  </span>
                </span>
              </button>
            ))}
            {!filtered.length && (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">{t('till.noMatches')}</div>
            )}
          </div>

          {!showQuickAdd ? (
            <button
              type="button"
              className="mt-1 w-full rounded-sm px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
              onClick={() => {
                setShowQuickAdd(true);
                setNewName(query.trim());
              }}
            >
              + {t('till.newCustomer')}
            </button>
          ) : (
            <div className="space-y-2 p-1">
              <input
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-primary"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('till.customerName')}
                autoFocus
              />
              <input
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-primary"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder={t('till.phoneOptional')}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  disabled={busy}
                  onClick={quickAdd}
                >
                  {busy ? t('till.savingCustomer') : t('till.addSelect')}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                  onClick={() => {
                    setShowQuickAdd(false);
                    setError(null);
                  }}
                >
{t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
