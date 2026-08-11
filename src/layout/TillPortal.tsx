import { useState } from 'react';
import { Home, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useStoreData } from '../hooks/useStoreData';
import { getPosBridge } from '../bridge';
import TillView from '../pages/TillView';

export default function TillPortal({ onHome }: { onHome: () => void }) {
  const { user, logout } = useAuth();
  const { products, categories, customers, settings, error, reload } = useStoreData();
  const [holdCount, setHoldCount] = useState(0);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onHome}
            title="Back to launcher"
          >
            <Home className="size-4" />
          </Button>
          <span className="font-semibold">
            {settings?.store ? `${settings.store} · Order & Billing` : 'Order & Billing'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{user?.fullname}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void logout();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
          <Button variant="ghost" size="sm" onClick={() => getPosBridge().quit()}>
            Quit
          </Button>
        </div>
      </header>

      {error && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <main className="min-h-0 flex-1">
        <TillView
          products={products}
          categories={categories}
          customers={customers}
          settings={settings}
          holdCount={holdCount}
          onHoldCount={setHoldCount}
          onRefresh={reload}
        />
      </main>
    </div>
  );
}
