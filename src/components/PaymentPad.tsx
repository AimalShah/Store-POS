import { useRef } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

type Props = {
  value: string;
  onChange: (value: string) => void;
  due: number;
  symbol: string;
  showQuickCash?: boolean;
  showNumpad?: boolean;
};

const SA_NOTES = [10, 20, 50, 100, 200];

function formatAmount(n: number) {
  return n.toFixed(2);
}

export default function PaymentPad({
  value,
  onChange,
  due,
  symbol,
  showQuickCash = true,
  showNumpad = true,
}: Props) {
  // After Exact / note pick, the next digit replaces instead of appending.
  const replaceNext = useRef(false);
  const { t } = useLocale();

  const setAmount = (amount: number) => {
    onChange(formatAmount(amount));
    replaceNext.current = true;
  };

  const append = (key: string) => {
    if (key === 'C') {
      onChange('');
      replaceNext.current = false;
      return;
    }
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      replaceNext.current = false;
      return;
    }

    if (key === '.') {
      if (replaceNext.current || !value) {
        onChange('0.');
        replaceNext.current = false;
        return;
      }
      if (value.includes('.')) return;
      onChange(`${value}.`);
      return;
    }

    if (replaceNext.current || value === '' || value === '0') {
      onChange(key);
      replaceNext.current = false;
      return;
    }

    const next = value + key;
    const [, dec] = next.split('.');
    if (dec && dec.length > 2) return;
    onChange(next);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <div className="space-y-3">
      {showQuickCash && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAmount(due)}
            className="rounded-md border-2 border-border bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-[3px_3px_0_0] shadow-black/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            {t('payment.exact', { symbol, amount: due.toFixed(2) })}
          </button>
          {SA_NOTES.map((note) => (
            <button
              key={note}
              type="button"
              onClick={() => setAmount(note)}
              className="rounded-md border-2 border-border bg-card px-3 py-2 text-sm font-semibold shadow-[3px_3px_0_0] shadow-black/15 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {symbol}
              {note}
            </button>
          ))}
        </div>
      )}
      {showNumpad && (
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => append(k)}
              className="flex h-14 items-center justify-center rounded-lg border-2 border-border bg-card text-lg font-bold shadow-[3px_3px_0_0] shadow-black/15 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => append('C')}
            className="col-span-3 flex h-11 items-center justify-center rounded-lg border-2 border-border bg-card text-sm font-semibold text-muted-foreground shadow-[3px_3px_0_0] shadow-black/15 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            {t('payment.clear')}
          </button>
        </div>
      )}
    </div>
  );
}
