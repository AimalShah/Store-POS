import { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

type Props = {
  onSubmit: (pin: string) => void;
  error?: string | null;
  autoSubmit?: boolean;
  disabled?: boolean;
  busy?: boolean;
  maxLength?: number;
};

export default function PinPad({
  onSubmit,
  error,
  autoSubmit = true,
  disabled = false,
  busy = false,
  maxLength = 6,
}: Props) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const pressDigit = (d: string) => {
    if (disabled || busy) return;
    const next = (pin + d).slice(0, maxLength);
    setPin(next);
    if (autoSubmit && next.length >= 4) {
      onSubmit(next);
      setPin('');
    }
  };

  const pressBackspace = () => {
    if (disabled || busy) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const clear = () => {
    if (disabled || busy) return;
    setPin('');
  };

  const submit = () => {
    if (disabled || busy) return;
    if (pin.length < 4) return;
    onSubmit(pin);
    setPin('');
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const keys: (string | { label: string; action: () => void })[] = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    { label: 'C', action: clear },
    '0',
    { label: '⌫', action: pressBackspace },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        className="sr-only"
        value={pin}
        autoComplete="off"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, maxLength);
          setPin(digits);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Backspace') {
            e.preventDefault();
            pressBackspace();
          }
        }}
      />

      <div className="flex h-4 items-center gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'size-3 rounded-full border border-muted-foreground/40 transition-colors',
              i < pin.length && 'bg-primary border-primary'
            )}
          />
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid w-56 grid-cols-3 gap-2" onClick={() => inputRef.current?.focus()}>
        {keys.map((k, i) =>
          typeof k === 'string' ? (
            <Button
              key={i}
              type="button"
              variant="outline"
              size="lg"
              className="h-14 text-xl"
              onClick={() => pressDigit(k)}
              disabled={disabled || busy}
            >
              {k}
            </Button>
          ) : (
            <Button
              key={i}
              type="button"
              variant="outline"
              size="lg"
              className="h-14 text-lg"
              onClick={k.action}
              disabled={disabled || busy}
            >
              {k.label === '⌫' ? <Delete className="size-5" /> : k.label}
            </Button>
          )
        )}
      </div>

      <Button
        type="button"
        size="lg"
        className="w-56"
        onClick={submit}
        disabled={disabled || busy || pin.length < 4}
      >
        {busy ? 'Checking…' : 'Enter'}
      </Button>
    </div>
  );
}
