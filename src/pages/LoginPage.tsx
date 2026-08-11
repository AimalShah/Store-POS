import { useState } from 'react';
import { Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PinPad from '../components/PinPad';

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Store className="mb-2 size-10 text-primary" />
          <CardTitle className="text-xl">Store POS</CardTitle>
          <CardDescription>
            {mode === 'pin' ? 'Enter your PIN to open the till' : 'Sign in with a password'}
          </CardDescription>
        </CardHeader>

        <div className="px-6 pb-6">
          {serverError && (
            <p className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </p>
          )}

          {mode === 'pin' ? (
            <PinPad
              onSubmit={onPinSubmit}
              error={pinError}
              busy={busy}
              autoSubmit
            />
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
            className="mt-4 w-full"
            onClick={() => {
              setMode(mode === 'pin' ? 'password' : 'pin');
              setPinError(null);
              setError(null);
            }}
          >
            {mode === 'pin' ? 'Sign in with password instead' : 'Use PIN pad instead'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
