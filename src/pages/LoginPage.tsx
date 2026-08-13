import { useState } from 'react';
import { Store, Zap, ClipboardList, Utensils, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PinPad from '../components/PinPad';

const YEAR = new Date().getFullYear();

export default function LoginPage() {
  const { login, loginByPin, serverError } = useAuth();
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  const [pinError, setPinError] = useState<string | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onPinSubmit = async (pin: string) => {
    setPinError(null);
    setBusy(true);
    try {
      await loginByPin(pin);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Incorrect PIN');
      setBusy(false);
    }
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setBusy(false);
    }
  };

  const features = [
    { icon: Zap, text: 'Lightning-fast PIN sign-in' },
    { icon: Utensils, text: 'Live kitchen tickets' },
    { icon: ClipboardList, text: 'Clear daily sales reports' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand hero */}
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full bg-white/10" />

        <div className="relative flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/15">
            <Store className="size-6" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Store POS</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            The till that keeps up with the rush.
          </h1>
          <p className="max-w-md text-base text-primary-foreground/80">
            Fast PIN checkout, live kitchen tickets, and daily reports — everything your
            counter needs in one register.
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                  <f.icon className="size-4" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-sm text-primary-foreground/70">
          <ShieldCheck className="size-4" />
          <span>
            © {YEAR} Store POS · Secure local register
          </span>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-center justify-center bg-muted/30 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="size-5" />
            </div>
            <span className="text-lg font-semibold">Store POS</span>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="items-center justify-center text-center">
              <div className='flex justify-center'>
                <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Store className="size-6" />
                </div>
              </div>
              <CardTitle className="text-xl">Welcome back</CardTitle>
              <CardDescription>
                {mode === 'pin'
                  ? 'Enter your PIN to open the till'
                  : 'Sign in with your password'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {serverError && (
                <p className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {serverError}
                </p>
              )}

              {mode === 'pin' ? (
                <PinPad onSubmit={onPinSubmit} error={pinError} busy={busy} autoSubmit />
              ) : (
                <form className="flex flex-col gap-4" onSubmit={onPasswordSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>
              )}

              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => {
                  setMode(mode === 'pin' ? 'password' : 'pin');
                  setPinError(null);
                  setError(null);
                }}
              >
                {mode === 'pin' ? 'Sign in with password instead' : 'Use PIN pad instead'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
