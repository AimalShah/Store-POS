import { useState } from 'react';
import { Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PinPad from '../components/PinPad';

export default function FirstRunWizard() {
  const { completeFirstRun } = useAuth();
  const [store, setStore] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onPinSubmit = async (value: string) => {
    if (!store.trim()) {
      setPinError('Enter a store name first');
      return;
    }
    setPinError(null);
    setBusy(true);
    try {
      await completeFirstRun(store.trim(), value);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Setup failed');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Store className="mb-2 size-10 text-primary" />
          <CardTitle className="text-xl">Welcome to Store POS</CardTitle>
          <CardDescription>
            Set up your store and an admin PIN to get started.
          </CardDescription>
        </CardHeader>

        <div className="flex flex-col gap-4 px-6 pb-6">
          <div className="grid gap-2">
            <Label htmlFor="store">Store name</Label>
            <Input
              id="store"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="e.g. Zinger House"
              autoFocus
              disabled={busy}
            />
          </div>

          <div className="grid gap-2">
            <Label>Admin PIN</Label>
            <PinPad
              onSubmit={onPinSubmit}
              error={pinError}
              busy={busy}
              autoSubmit={false}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
