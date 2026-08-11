import { useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Home,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings as SettingsIcon,
  ShoppingCart,
  UserCog,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStoreData } from '../hooks/useStoreData';
import { getPosBridge } from '../bridge';
import CatalogView from '../pages/CatalogView';
import CustomersView from '../pages/CustomersView';
import DashboardView from '../pages/DashboardView';
import SettingsView from '../pages/SettingsView';
import TeamView from '../pages/TeamView';
import TransactionsModal from '../components/TransactionsModal';
import { Button } from '../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../components/ui/sidebar';

type NavView =
  | 'dashboard'
  | 'catalog'
  | 'sales'
  | 'customers'
  | 'reports'
  | 'shifts'
  | 'team'
  | 'settings';

type Props = {
  onHome: () => void;
};

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onAction: () => void };
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action && (
          <div className="pb-6">
            <Button onClick={action.onAction}>{action.label}</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ManagementPortal({ onHome }: Props) {
  const { user, hasPerm, logout } = useAuth();
  const { products, categories, customers, settings, error, reload } = useStoreData();
  const [view, setView] = useState<NavView>('dashboard');

  const symbol = settings?.symbol || '$';

  const items: { id: NavView; label: string; icon: typeof Package; show: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    {
      id: 'catalog',
      label: 'Catalog',
      icon: Package,
      show: hasPerm('perm_products') || hasPerm('perm_categories'),
    },
    { id: 'sales', label: 'Sales', icon: ReceiptText, show: hasPerm('perm_transactions') },
    { id: 'customers', label: 'Customers', icon: Users, show: true },
    { id: 'reports', label: 'Reports', icon: BarChart3, show: hasPerm('perm_transactions') },
    { id: 'shifts', label: 'Shifts', icon: CalendarClock, show: hasPerm('perm_transactions') },
    { id: 'team', label: 'Team', icon: UserCog, show: hasPerm('perm_users') },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, show: hasPerm('perm_settings') },
  ];

  const visible = items.filter((i) => i.show);
  if (!visible.some((i) => i.id === view)) {
    const first = visible[0]?.id || 'dashboard';
    if (first !== view) setView(first);
  }

  const title = visible.find((i) => i.id === view)?.label || 'Dashboard';

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-base"
                tooltip="Launcher"
                onClick={onHome}
              >
                <ShoppingCart className="size-5" />
                <span className="font-semibold">Store POS</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visible.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={view === item.id}
                      onClick={() => setView(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sign out"
                onClick={() => {
                  void logout();
                }}
              >
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Quit" onClick={() => getPosBridge().quit()}>
                <Home />
                <span>Quit</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="px-4 py-2 text-xs text-muted-foreground">
            {user?.fullname} · {user?.username}
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-base font-semibold">{title}</h1>
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {settings?.store || 'Store POS'}
          </div>
        </header>

        {error && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-auto p-6">
          {view === 'dashboard' && (
            <DashboardView settings={settings} />
          )}

          {view === 'catalog' && (
            <CatalogView
              products={products}
              categories={categories}
              symbol={symbol}
              canProducts={hasPerm('perm_products')}
              canCategories={hasPerm('perm_categories')}
              onChanged={reload}
            />
          )}

          {view === 'sales' && (
            <TransactionsModal
              embedded
              open
              symbol={symbol}
              settings={settings}
              onClose={() => setView('dashboard')}
            />
          )}

          {view === 'customers' && (
            <CustomersView customers={customers} onChanged={reload} />
          )}

          {view === 'reports' && (
            <EmptyState
              title="Reports"
              description="Date-range sales, category and payment-method totals, and best sellers will appear here."
            />
          )}

          {view === 'shifts' && (
            <EmptyState
              title="Shifts"
              description="Open and closed shifts with cash reconciliation will appear here."
            />
          )}

          {view === 'team' && <TeamView />}

          {view === 'settings' && <SettingsView settings={settings} onSaved={reload} />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
