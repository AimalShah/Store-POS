import { LayoutDashboard, LogOut, ShoppingCart, Store } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { getPosBridge } from '../bridge';

export type Portal = 'till' | 'dashboard';

type Props = {
  onOpen: (portal: Portal) => void;
};

export default function PortalHome({ onOpen }: Props) {
  const { user, hasPerm, logout, apiInfo } = useAuth();

  const canManage =
    hasPerm('perm_products') ||
    hasPerm('perm_categories') ||
    hasPerm('perm_transactions') ||
    hasPerm('perm_users') ||
    hasPerm('perm_settings');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <Store className="size-5 text-primary" />
          <span className="text-lg font-semibold">Store POS</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{user?.fullname}</span>
          <span>·</span>
          <span>Till #{apiInfo?.till || 1}</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-2xl font-semibold">Where to?</h1>
        <div className="flex w-full max-w-2xl flex-col gap-6 sm:flex-row">
          <button
            type="button"
            className="group flex-1 text-left"
            onClick={() => onOpen('till')}
          >
            <Card className="h-full p-6 transition-colors group-hover:border-primary group-hover:bg-primary/5">
              <CardHeader className="p-0">
                <ShoppingCart className="mb-4 size-10 text-primary" />
                <CardTitle className="text-xl">Order &amp; Billing</CardTitle>
                <CardDescription className="text-base">
                  Take orders, take payments, and print receipts at the counter.
                </CardDescription>
              </CardHeader>
            </Card>
          </button>

          {canManage && (
            <button
              type="button"
              className="group flex-1 text-left"
              onClick={() => onOpen('dashboard')}
            >
              <Card className="h-full p-6 transition-colors group-hover:border-primary group-hover:bg-primary/5">
                <CardHeader className="p-0">
                  <LayoutDashboard className="mb-4 size-10 text-primary" />
                  <CardTitle className="text-xl">Dashboard</CardTitle>
                  <CardDescription className="text-base">
                    Manage the catalog, sales, customers, team, and settings.
                  </CardDescription>
                </CardHeader>
              </Card>
            </button>
          )}
        </div>
      </main>

      <footer className="flex h-14 items-center justify-between border-t px-6 text-sm text-muted-foreground">
        <span>Signed in as {user?.username}</span>
        <div className="flex items-center gap-2">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => getPosBridge().quit()}
          >
            Quit
          </Button>
        </div>
      </footer>
    </div>
  );
}
